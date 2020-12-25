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
const Ready = require('@serialport/parser-ready');
const WebSocket = require("ws");
const { prepare } = require("./tools/prepare");
const { shouldProcessBeActive } = require("./tools/shouldProcessBeActive");
const { createProcessesStatesPackage } = require("./tools/createProcessesStatesPackage");
// TODO: Вообще конфиг должен по факту с сервера прилетать, но это типа такая локальная базовая копия конфига
let { config } = require("./config");
let isPortSendsReady = false;

const portName = process.env.SERIAL_PORT_ADRESS || "/dev/ttyUSB0";
const WSSUrl = process.env.WSS_URL || "wss://rapidfarm2team.herokuapp.com/";
const secret = process.env.FARM_SECRET || "?Hji6|48H*AOnID%YK1r@WDgRYTFIyzTkThx6UApx|8?*Lr6y}oeST}6%$8~g%ia";
const name = process.env.NAME || "Silver Farm";
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
function waitforReady() {
    while ( !isPortSendsReady ) {
        console.log('isPortSendsReady: ', isPortSendsReady);
    }
}
readyParser.addListener( "ready", () => {
    console.log("readyParser got: ready ");
    port.pipe( readlineParser );
    isPortSendsReady = true;
    port.unpipe( readyParser );
} );
async function updateProcessState( process ) {
    console.log("updateProcessState send to port: ", ( shouldProcessBeActive( process ) ? "e" : "d" ) + process.short );
    port.write( ( shouldProcessBeActive( process ) ? "e" : "d" ) + process.short);
    console.log("updateProcessState finished");
}
port.addListener( "open", () => {
    console.log( "Port opened" );
} );

async function requestSensorValue( sensor ) {
    console.log("requestSensorValue: ", "g" + sensor.short );
    port.write( "g" + sensor.short );
    console.log("requestSensorValue finished");
}

function sendToWSServer( data ) {
    console.log("sendToWSServer: ", data);
    if ( connection.readyState === connection.OPEN ) connection.send( JSON.stringify( data ) );
    else console.log('connection.readyState: ', connection.readyState);
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
        console.log( Date() );
        if( port.isOpen ) unsafeCallback();
        else console.log( "unsuccesful call: ", unsafeCallback.name, ", port closed" );
        console.log();
    };
}

async function portSafeRepeater( unsafeCB, milliseconds ) {
    const safeCallback = protectCallback( unsafeCB );
    waitforReady();
    safeCallback();
    repeaterList.push( setInterval( safeCallback, milliseconds ) );
}

function processStatesUpdater() {
    for( const process of config.processes ) {
        if( !process.isAvailable ) continue;
        // if( shouldProcessBeActive( process ) === shouldProcessBeActive(process) ) continue;
        updateProcessState( process );
        sendToWSServer( {
            class: "event",
            process: process.long,
            isActive: shouldProcessBeActive(process)
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
    sendToWSServer( {
        class: "activitySyncPackage",
        package: createProcessesStatesPackage( config.processes )
    } );
    sendToWSServer( {
        class: "configPackage",
        package: config
    } );
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
                        package: createProcessesStatesPackage( config.processes )
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
    // portSafeRepeater( connectedSensorsPollster, 5000/* 900000 */ );
} );
connection.addListener( "message", beforeAuthHandler );
readlineParser.addListener( "data", serialLineHandler );
connection.addListener( "error", error => {
    console.log( "WebSocket error: " );
    console.log(error);
} );

connection.addListener( "close", ( code, msg ) => {
    console.log( "WebSocket closed: ", code, msg );
    if ( msg === "shutdown farm" ) {
        process.exit( 0 );
    }
} );

port.addListener( "close", () => {
    console.log( "Port closed" );
} );

port.addListener( "error", error => {
    console.log( "Error on port: " );
    console.log(error);
} );

function shutdown() {
    console.log("Exiting...\n\nClosing Serial port...");
    port.close(err => {
        console.log("Serial port closed.\n\nClosing Websocket connection...");
        connection.close( 1000, "shutdown farm");
        repeaterList.forEach( v => clearInterval( v ) );
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
