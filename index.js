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
    //     baudRate: 115200,
    //     dataBits: 8,
    //     parity: "none",
    //     stopBits: 1,
    //     xoff:true // flowControl: false
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
const WebSocket = require("ws");
const { prepare } = require("./tools/prepare");
const { shouldProcessBeActive } = require("./tools/shouldProcessBeActive");
const { createEmptyProcessesStates } = require("./tools/createEmptyProcessesStates");
let config = {
    processes: [
        {
            short: "w",
            long: "watering",
            title: "Поливной насос",
            isAvailable: true,
            timings: [
                [ [ 2,  9  ], [ 2,  24 ] ], // msfromBeginingOfDay, msfromEndOfDay
                [ [ 4,  33 ], [ 4,  48 ] ], // возможно действительно даже лучше хранить просто в миллисекундах
                [ [ 6,  57 ], [ 7,  12 ] ], // но для отладки так конечно удобнее
                [ [ 9,  21 ], [ 9,  36 ] ],
                [ [ 11, 45 ], [ 12, 0  ] ],
                [ [ 14, 9  ], [ 14, 24 ] ],
                [ [ 16, 33 ], [ 16, 48 ] ],
                [ [ 18, 57 ], [ 19, 12 ] ],
                [ [ 21, 21 ], [ 21, 36 ] ],
                [ [ 23, 45 ], [ 24, 0  ] ],
            ]
        },
        {
            short: "l",
            long: "lighting",
            title: "Освещение",
            isAvailable: true,
            timings: [
                [ [ 7 ], [ 23 ] ],
            ]
        },
        {
            short: "o",
            long: "oxidation",
            title: "Аэрация раствора",
            isAvailable: true,
            timings: [
                [ [ 1,  54 ], [ 2,  24 ] ],
                [ [ 4,  18 ], [ 4,  48 ] ],
                [ [ 6,  42 ], [ 7,  12 ] ],
                [ [ 9,  6  ], [ 9,  36 ] ],
                [ [ 11, 30 ], [ 12, 0  ] ],
                [ [ 13, 54 ], [ 14, 24 ] ],
                [ [ 16, 18 ], [ 16, 48 ] ],
                [ [ 18, 42 ], [ 19, 12 ] ],
                [ [ 21, 6  ], [ 21, 36 ] ],
                [ [ 23, 30 ], [ 24, 0  ] ],
            ]
        },
        {
            short: "gh",
            long: "groundHeating",
            title: "Подогрев почвы",
            isAvailable: false,
            timings: []
        },
        {
            short: "wh",
            long: "waterHeating",
            title: "Подогрев раствора",
            isAvailable: false,
            timings: []
        },
        {
            short: "ah",
            long: "airHeating",
            title: "Подогрев воздуха",
            isAvailable: false,
            timings: []
        },
    ],
    sensors: [
        {
            short: "gt",
            long: "groundTemperature",
            title: "Температура почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "wt",
            long: "waterTemperature",
            title: "Температура воды",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "at",
            long: "airTemperature",
            title: "Температура вохдуха",
            isConnected: true,
            criticalBorders: {
                lower: 10,
                upper: 30,
            }
        },
        {
            short: "gh",
            long: "groundHumidity",
            title: "Влажность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "ah",
            long: "airHumidity",
            title: "Влажность воздуха",
            isConnected: true,
            criticalBorders: {
                lower: 12,
                upper: 1000,
            }
        },
        {
            short: "go",
            long: "groundOxidation",
            title: "Кислотность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "wo",
            long: "waterOxidation",
            title: "Кислотность воды",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "gs",
            long: "groundSalt",
            title: "Солёность почвы",
            isConnected: false,
            criticalBorders: {}
        },
        {
            short: "ws",
            long: "waterSalt",
            title: "Солёность воды",
            isConnected: false,
            criticalBorders: {}
        }
    ]
};
let processesStates = createEmptyProcessesStates( config.processes );

const portName = "/dev/ttyUSB0";
const wssurl = "ws://127.0.0.1:3000/";
const secret = "asdasdasd";
const name = "Silver Farm";
const connection = new WebSocket( wssurl );
const port = new SerialPort(portName, {
    baudRate: 115200,
});
const parser = new Readline({ delimiter: "\r\n" });
port.pipe(parser);

function invertProcessState( process ) {
    port.write( ( process.isActive ? "d" : "e" ) + process.short + "\n" );
    process.isActive = shouldProcessBeActive( process );
}
function requestSensorValue( sensor ) {
    port.write( "g" + process.short + "\n" );
}
function sendToServer( data ) {
    connection.send( JSON.stringify( data ) );
}
function afterAuthParserLineHandler( line ) {
    const { sensor, value } = JSON.parse( line );
    // Пока ферма присылает нам только показания с датчиков
    // Но возможно потом ещё что-то добавим
    if( false /* Выходит за рамки? */ ) {
        // отправить criticalevent если выходит за рамки
    } else {
        sendToServer( {
            class: "records",
            sensor,
            value
        } );
    }
}
function beforeAuthHandler( input ) {
    const data = prepare( input );
    if( data.class !== "loginAsFarm" || data.report.isError ) return;
    sendToServer( {
        class: "activitySyncPackage",
        package: processesStates
    } );
    sendToServer( {
        class: "configPackage",
        package: config
    } );
    parser.addListener( "data", afterAuthParserLineHandler );
    connection.addListener( "message", afterAuthHandler );
    connection.removeListener( "message", beforeAuthHandler );
}
function afterAuthHandler( input ) {
    const data = prepare( input );
    switch ( data.class ) {
        case "set":
            switch ( data.what ) {
                case "timings":
                    config.processes.find( process => (
                        process.long === data.process
                    ) ).timings = data.timings;
                    break;
                case "config":
                    config = data.config;
                    break;
            }
            break;
        case "get":
            switch ( data.what ) {
                case "activitySyncPackage":
                    sendToServer( {
                        class: "activitySyncPackage",
                        package: processesStates
                    } );
                    break;
                case "configPackage":
                    sendToServer( {
                        class: "configPackage",
                        package: config
                    } );
                    break;
            }
            break;
        case "execute":
            switch ( data.what ) {
                case "shutDownFarm":
                    break;
                case "updateArduino":
                    break;
            }
            break;
        default:
            break;
    }
}
connection.addListener( "message", beforeAuthHandler );
connection.addListener( "message", input => {
    console.log( "WebSocket gets: ", input );
} );
connection.addListener( "error", error => {
    console.log( "WebSocket error: ", error );
} );
port.addListener( "open", () => {
    console.log( "Port opened" );
    connection.addListener( "open", () => {
        sendToServer( {
            class: "loginAsFarm",
			secret,
			name
        } );
    } );
} );
port.addListener( "close", () => {
    console.log( "Port closed" );
} );
port.addListener( "error", err => {
    console.log( "Error on port: ", err );
} );

setInterval( function() {
    for( const process of config.processes ) {
        if( !process.isAvailable ) continue;
        if( shouldProcessBeActive( process ) === process.isActive ) continue;
        invertProcessState( process );
        // TODO: Послать EVENT на сервер
        sendToServer( {
            class: "event",
			process: process.long,
            isActive: process.isActive
        } );
    }
}, 5000 );

setInterval( function() {
    for( const sensor of config.sensors ) {
        if( !sensor.isConnected ) continue;
        requestSensorValue( sensor );
    }
}, 900000 );
