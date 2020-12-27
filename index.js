// https://www.npmjs.com/package/raspi-serial
// https://www.npmjs.com/package/serialport
// https://www.npmjs.com/package/raspi
// const ByteLength = require("@serialport/parser-byte-length")
// const parser = port.pipe(new ByteLength({length: 8}))
// const Delimiter = require("@serialport/parser-delimiter")
// const parser = port.pipe(new Delimiter({ delimiter: "\n" }))
// const InterByteTimeout = require("@serialport/parser-inter-byte-timeout")
// const parser = port.pipe(new InterByteTimeout({interval: 30}))
// defaults for Arduino serial communication
// {
        // baudRate: 115200,
        // dataBits: 8,
        // parity: "none",
        // stopBits: 1,
        // xoff:true // flowControl: false
    // }
    // const { exec } = require("child_process");

    // exec( "cat /sys/class/thermal/thermal_zone0/temp", ( error, stdout, stderr ) => {
    //     if( error ) {
    //         console.log( `error: ${ error.message }` );
    //         return;
    //     }
    //     console.log( parseInt( stdout.split( "\n" )[ 0 ], 10 ) / 1000 );
    // } );

const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");
const Ready = require("@serialport/parser-ready");
const WebSocket = require("ws");

const { prepare } = require("./tools/prepare");
const { shouldProcessBeActive } = require("./tools/shouldProcessBeActive");
const { createProcessesStatesPackage } = require("./tools/createProcessesStatesPackage");

// TODO: Вообще конфиг должен по факту с сервера прилетать, но это типа такая локальная базовая копия конфига
const {
    getConfig,
    setConfig,
    portName,
    WSSUrl,
    secret,
    name
} = require("./config");

let isPortSendedReady = false;
let processesStates = Object.fromEntries(
    getConfig().processes.map(
        proc => [ proc.long, false ]
    )
);

const connection = new WebSocket( WSSUrl );
const port = new SerialPort(portName, {
    baudRate: 115200,
    // dataBits: 8,
    // parity: "none",
    // stopBits: 1,
    // xoff:true // flowControl: false
});
const readlineParser = new Readline({ delimiter: "\r\n" });
const readyParser = new Ready({ delimiter: "ready" });
const repeaterList = [];
port.pipe( readyParser );

function sendCmdToFarmForSetProcState( proc ) {
    if (!proc?.long) console.log("proc: ", proc);
    console.log( "updateProcessStateOnFarm send to port:", ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    port.write( ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    console.log( "updateProcessStateOnFarm finished" );
}

function requestSensorValue( sensor ) {
    console.log( "requestSensorValue: ", "g" + sensor.short );
    port.write( "g" + sensor.short );
    console.log( "requestSensorValue finished" );
}

function sendToWSServer( data ) {
    console.log( "sendToWSServer: ", data );
    if ( connection.readyState === connection.OPEN ) connection.send( JSON.stringify( data ) );
    else console.log( "connection.readyState: ", connection.readyState );
    console.log( "sendToWSServer finished" );
}

function serialLineHandler( line ) {
    console.log( "serialLineHandler got: ", line );
    const { sensor, value } = JSON.parse( line );
    // Пока ферма присылает нам только показания с датчиков
    // Но возможно потом ещё что-то добавим
    if( false /* Выходит за рамки? */ ) {
        // отправить criticalevent если выходит за рамки
    } else {
        sendToWSServer( {
            class: "records",
            sensor,
            value
        } );
    }
    console.log( "serialLineHandler finished" );
}

function protectCallback( unsafeCallback ) {
    return function() {
        console.log( "call: ", unsafeCallback.name, ", when: ", Date() );
        if( port.isOpen && isPortSendedReady ) unsafeCallback( ...arguments );
        else console.log( "was unsuccesful, because port closed or not send ready yet" );
        console.log();
    };
}

async function portSafeRepeater( unsafeCB, milliseconds, ...args ) {
    const safeCallback = () => protectCallback( unsafeCB )( ...args );
    try {
        await( new Promise( ( resolve, reject ) => {
            setTimeout( () => {
                reject();
            }, 60000 );
            const asd = setInterval( () => {
                if ( isPortSendedReady ) {
                    clearInterval( asd );
                    resolve();
                }
            }, 3000 );
        } ) );
        safeCallback();
        repeaterList.push(
            setInterval(
                safeCallback,
                milliseconds
            )
        );
    } catch ( error ) {
        console.log( "error: ", error );
        shutdown();
    }
}

function processStateUpdater( proc ) {
    sendCmdToFarmForSetProcState( proc );
    if( processesStates[ proc.long ] === shouldProcessBeActive( proc ) ) return;
    processesStates[ proc.long ] = shouldProcessBeActive( proc );
    sendToWSServer( {
        class: "event",
        process: proc.long,
        isActive: processesStates[ proc.long ]
    } );
}

function waitForAuthHandler( input ) {
    console.log( "waitForAuthHandler started" );
    const data = prepare( input );
    if( data.class !== "loginAsFarm" || data.report.isError ) return;
    processesStates = createProcessesStatesPackage( getConfig().processes );
    sendToWSServer( {
        class: "activitySyncPackage",
        package: processesStates
    } );
    sendToWSServer( {
        class: "configPackage",
        package: getConfig()
    } );
    for( const proc of getConfig().processes ) {
        if( !proc.isAvailable ) continue;
        protectCallback( sendCmdToFarmForSetProcState )( proc );
    }
    connection.removeListener( "message", waitForAuthHandler );
    connection.addListener( "message", afterAuthHandler );
    console.log( "waitForAuthHandler finished" );
}

function afterAuthHandler( input ) {
    console.log( "afterAuthHandler started" );
    const data = prepare( input );
    switch ( data.class ) {
        case "set":
            switch ( data.what ) {
                case "timings":
                    setConfig( prevConfig => {
                        for ( const proc of prevConfig.processes ) {
                            if ( proc.long === data.process ) {
                                proc.timings = data.timings;
                                // TODO: updateLocalFarmConfigFile();
                                break;
                            }
                        }
                        return prevConfig;
                    } );
                    break;
                case "config":
                    setConfig( () => data.config );
                    // TODO: updateLocalFarmConfigFile();
                    break;
            }
            break;
        case "get":
            switch ( data.what ) {
                case "activitySyncPackage":
                    sendToWSServer( {
                        class: "activitySyncPackage",
                        package: processesStates
                    } );
                    break;
                case "configPackage":
                    sendToWSServer( {
                        class: "configPackage",
                        package: getConfig()
                    } );
                    break;
            }
            break;
        case "execute":
            switch ( data.what ) {
                case "shutDownFarm":
                    // TODO: shutDownFarm();
                    break;
                case "updateArduino":
                    // TODO: updateArduino();
                    break;
            }
            break;
        default:
            break;
    }
    console.log( "afterAuthHandler finished" );
}

connection.addListener( "open", () => {
    console.log( "Connection opened " );
    sendToWSServer( {
        class: "loginAsFarm",
        secret,
        name
    } );
    for( const proc of getConfig().processes ) {
        if( !proc.isAvailable ) continue;
        portSafeRepeater( processStateUpdater, 5000, proc );
    }
    for( const sensor of getConfig().sensors ) {
        if( !sensor.isConnected ) continue;
        portSafeRepeater( requestSensorValue, 900000, sensor );
    }
} );

port.addListener( "open", () => {
    console.log( "Port opened" );
} );

readyParser.addListener( "ready", () => {
    console.log("readyParser got: ready ");
    port.pipe( readlineParser );
    isPortSendedReady = true;
    port.unpipe( readyParser );
} );

readlineParser.addListener( "data", serialLineHandler );

connection.addListener( "message", waitForAuthHandler );

connection.addListener( "error", wsError => {
    console.log( "WebSocket error: " );
    port.close( portError => {
        if ( portError ) console.log( portError );
        throw wsError;
    });
} );

port.addListener( "error", error => {
    console.log( "Error on port: " );
    console.log("shutdown date:", new Date());
    throw error;
} );

connection.addListener( "close", ( code, msg ) => {
    console.log( "WebSocket closed: ", code, msg );
    port.close( portError => {
        if ( portError ) throw portError;
        process.exit( ~~(msg !== "shutdown farm") );
    });
} );

port.addListener( "close", () => {
    console.log( "Port closed" );
    connection.close( 1000, "Port closed");
} );

function shutdown() {
    console.log("Exiting...\n\nClosing Serial port...");
    port.close(err => {
        if (err) throw err;
        console.log("Serial port closed.\n\nClosing Websocket connection...");
        connection.close( 1000, "shutdown farm");
        repeaterList.forEach( v => clearInterval( v ) );
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
