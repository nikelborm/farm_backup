// https://www.npmjs.com/package/raspi-serial
// https://www.npmjs.com/package/serialport
// https://www.npmjs.com/package/raspi
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
// const ByteLength = require('@serialport/parser-byte-length')
// const parser = port.pipe(new ByteLength({length: 8}))
// const Delimiter = require('@serialport/parser-delimiter')
// const parser = port.pipe(new Delimiter({ delimiter: '\n' }))
// const InterByteTimeout = require('@serialport/parser-inter-byte-timeout')
// const parser = port.pipe(new InterByteTimeout({interval: 30}))
const { exec } = require("child_process");
const WebSocket = require("ws");
const portName = '/dev/ttyUSB0';
// defaults for Arduino serial communication
// {
//     baudRate: 115200,
//     dataBits: 8,
//     parity: 'none',
//     stopBits: 1,
//     xoff:true // flowControl: false
// }
function setWateringState( isActive ) {
}
function setLightingState( isActive ) {
}
function setOxidationState( isActive ) {
}
function setGroundHeatingState( isActive ) {
}
function setWaterHeatingState( isActive ) {
}
function setAirHeatingState( isActive ) {
}
function getGroundTemperature() {
}
function getWaterTemperature() {
}
function getAirTemperature() {
}
function getGroundHumidity() {
}
function getAirHumidity() {
}
function getGroundOxidation() {
}
function getWaterOxidation() {
}
function getGroundSalt() {
}
function getWaterSalt() {
}

const wssurl = 'ws://127.0.0.1:3000/';
const connection = new WebSocket( wssurl );
const port = new SerialPort(portName, {
    baudRate: 115200,
})
function afterAuthHandler(params) {
    parser.on('data', line => {
        const { sensor, value } = JSON.parse(line);
        connection.send(JSON.stringify({
            class: "records",
            sensor,
            value
        }))
    });
}
const parser = new Readline({ delimiter: '\r\n' });
port.pipe(parser);
port.on("open", async () => {
    console.log('Port opened');
    // Авторизация на сервере
    // Подключение к вебсокету
    connection.onopen = (asd) => {
        // connection.
        connection.onmessage = e => {
            console.log(e.data)
        }
        connection.send(JSON.stringify({
            class:"loginAsFarm",
			secret: "asdasdasd",
			name: "asd"
        }))
        function waitForAuthorization(input) {
            const data = JSON.parse(input.toString());
            if( data.class === "loginAsFarm" && !data.report.isError) {
                connection.addListener("message", afterAuthHandler);
                connection.removeListener("message", waitForAuthorization);
            }
        }
        connection.addListener("message", waitForAuthorization);
    }
    connection.onerror = error => {
        console.log("WebSocket error:", error)
    }
});

port.on("close", (data) => {
    console.log("Port closed");
    console.log('data: ', data);
});
port.on("error", (data) => {
    console.log('Error on port');
    console.log('data: ', data);
});
port.write('Hello \0');

// const timerrrr = setInterval( () => {
// 	exec( "cat /sys/class/thermal/thermal_zone0/temp", ( error, stdout, stderr ) => {
// 		if ( error ) {
// 			console.log( `error: ${ error.message }` );
// 			return;
// 		}
// 		console.log( parseInt( stdout.split( "\n" )[ 0 ], 10 ) / 1000 );
// 	} );
// }, 500 );


// g - get

// gt - groundTemperature
// wt - waterTemperature
// at - airTemperature
// gh - groundHumidity
// ah - airHumidity
// go - groundOxidation
// wo - waterOxidation
// gs - groundSalt
// ws - waterSalt

// e - enable
// d - disable

// ww - watering
// ll - lighting
// oo - oxidation
// gh - groundHeating
// wh - waterHeating
// ah - airHeating
