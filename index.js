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
const minimist = require("minimist");

const { prepare } = require("./tools/prepare");
const { shouldProcessBeActive } = require("./tools/shouldProcessBeActive");
const { createProcessesStatesPackage } = require("./tools/createProcessesStatesPackage");

// TODO: Вообще конфиг должен по факту с сервера прилетать, но это типа такая локальная базовая копия конфига
let { config } = require("./config");
let isPortSendsReady = false;
let processesStates = Object.fromEntries(
    config.processes.map(
        proc => [ proc.long, false ]
    )
);
console.log('processesStates: ', processesStates);
const procArgs = minimist( process.argv.slice(2), {
    default: {
        serialAdress: "/dev/ttyUSB0",
        secret: "?Hji6|48H*AOnID%YK1r@WDgRYTFIyzTkThx6UApx|8?*Lr6y}oeST}6%$8~g%ia",
        WSSUrl: "wss://rapidfarm2team.herokuapp.com/",
        name: "Silver Farm"
    },
    alias: {
        a: "serialAdress",
        u: "WSSUrl",
        s: "secret",
        n: "name"
    }
});

const portName = process.env.SERIAL_PORT_ADRESS || procArgs.serialAdress;
const WSSUrl   = process.env.WSS_URL            || procArgs.WSSUrl;
const secret   = process.env.FARM_SECRET        || procArgs.secret;
const name     = process.env.NAME               || procArgs.name;

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

function updateProcessStateOnFarm( proc ) {
    console.log("updateProcessStateOnFarm send to port:", ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short );
    console.log('proc: ', proc);
    port.write( ( processesStates[ proc.long ] ? "e" : "d" ) + proc.short);
    console.log("updateProcessStateOnFarm finished");
}

// class Controller {
//     constructor( timeout ) {
//         this.timeout = timeout || 5000;
//         this.queue = [];
//         this.ready = true;
//     }
//     send = function ( cmd, callback ) {
//         sendCmdToLed( cmd );
//         if (callback)
//             callback();
//             // or simply `sendCmdToLed(cmd, callback)` if sendCmdToLed is async
//     };
//     exec = function ( ...args ) {
//         this.queue.push( args );
//         this.process();
//     };
//     process = function () {
//         if (this.queue.length === 0)
//             return;
//         if (!this.ready)
//             return;
//         var self = this;
//         this.ready = false;
//         this.send.apply(this, this.queue.shift());
//         setTimeout(function () {
//             self.ready = true;
//             self.process();
//         }, this.timeout);
//     };
// }
// Led.exec(cmd, function() {
//     console.log('Command sent');
// });

// const processesController = new Controller();
// const sensorsController = new Controller();

function requestSensorValue( sensor ) {
    console.log("requestSensorValue: ", "g" + sensor.short );
    port.write( "g" + sensor.short );
    console.log("requestSensorValue finished");
}

function sendToWSServer( data ) {
    console.log("sendToWSServer: ", data);
    if ( connection.readyState === connection.OPEN ) connection.send( JSON.stringify( data ) );
    else console.log("connection.readyState: ", connection.readyState);
    console.log("sendToWSServer finished");
}

function serialLineHandler( line ) {
    console.log("serialLineHandler got: ", line);
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
    console.log("serialLineHandler finished");
}

function protectCallback( unsafeCallback ) {
    return function() {
        console.log( "call: ", unsafeCallback.name, ", when: ", Date() );
        if( port.isOpen ) unsafeCallback( ...arguments );
        else console.log( "was unsuccesful, beacause port closed" );
        console.log();
    };
}

async function portSafeRepeater( unsafeCB, milliseconds ) {
    const safeCallback = protectCallback( unsafeCB );
    try {
        await( new Promise( (resolve, reject) => {
            setTimeout( () => {
                reject();
            }, 60000 );
            const asd = setInterval( () => {
                clearInterval(asd);
                if ( isPortSendsReady ) resolve();
            }, 3000 );
        }));
        safeCallback();
        repeaterList.push( setInterval( safeCallback, milliseconds ) );
    } catch (error) {
        console.log('error: ', error);
        shutdown();
    }
}

function processStatesUpdater() {
    for( const proc of config.processes ) {
        if( !proc.isAvailable ) continue;
        updateProcessStateOnFarm( proc );
        if( processesStates[ proc.long ] === shouldProcessBeActive( proc ) ) continue;
        processesStates[ proc.long ] = shouldProcessBeActive( proc );
        sendToWSServer( {
            class: "event",
            process: proc.long,
            isActive: processesStates[ proc.long ]
        } );
    }
}

function connectedSensorsPollster() {
    for( const sensor of config.sensors ) {
        if( !sensor.isConnected ) continue;
        requestSensorValue( sensor );
    }
}

function beforeAuthHandler( input ) {
    console.log("beforeAuthHandler started");
    const data = prepare( input );
    if( data.class !== "loginAsFarm" || data.report.isError ) return;
    processesStates = createProcessesStatesPackage( config.processes );
    sendToWSServer( {
        class: "activitySyncPackage",
        package: processesStates
    } );
    sendToWSServer( {
        class: "configPackage",
        package: config
    } );
    for( const process of config.processes ) {
        if( !process.isAvailable ) continue;
        protectCallback( updateProcessStateOnFarm )( process )
    }
    connection.removeListener( "message", beforeAuthHandler );
    connection.addListener( "message", afterAuthHandler );
    console.log("beforeAuthHandler finished");
}

function afterAuthHandler( input ) {
    console.log("afterAuthHandler started");
    const data = prepare( input );
    switch ( data.class ) {
        case "set":
            switch ( data.what ) {
                case "timings":
                    config.processes.find( process => (
                        process.long === data.process
                    ) ).timings = data.timings;
                    // TODO: updateLocalFarmConfigFile();
                    break;
                case "config":
                    config = data.config;
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
                        package: config
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
    console.log("afterAuthHandler finished");
}

connection.addListener( "open", () => {
    console.log("Connection opened ");
    sendToWSServer( {
        class: "loginAsFarm",
        secret,
        name
    } );
    portSafeRepeater( processStatesUpdater, 5000 );
    // portSafeRepeater( connectedSensorsPollster, 900000 );
} );

port.addListener( "open", () => {
    console.log( "Port opened" );
} );

readyParser.addListener( "ready", () => {
    console.log("readyParser got: ready ");
    port.pipe( readlineParser );
    isPortSendsReady = true;
    port.unpipe( readyParser );
} );

readlineParser.addListener( "data", serialLineHandler );

connection.addListener( "message", beforeAuthHandler );

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
