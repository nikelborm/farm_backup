// https://www.npmjs.com/package/raspi-serial
// https://www.npmjs.com/package/serialport
// https://www.npmjs.com/package/raspi
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const { exec } = require("child_process");
const WebSocket = require("ws");
const portName = '/dev/ttyUSB0';
// defaults for Arduino serial communication
// {
//     baudRate: 115200,
//     dataBits: 8,
//     parity: 'none',
//     stopBits: 1,
////     flowControl: false
// }

// const wssurl = 'wss://192.168.0.14:3000/';
const port = new SerialPort(portName, {
    baudRate: 115200
})
const parser = new Readline();
port.pipe(parser);
port.on("open", async () => {
    console.log('Port opened');
    // Авторизация на сервере
    // (await axios.post('https://site.com/', {
    //     foo: 'bar',
    //     headers: 
    // }))
    // Подключение к вебсокету
    // const connection = new WebSocket(wssurl);
    // connection.onopen = (asd) => {
    //     // connection.
    //     connection.onmessage = e => {
    //         console.log(e.data)
    //     }
    //     connection.send(JSON.stringify({
	// 		secret: "asdasdasd",
	// 		name: "asd"
	// 	}))

    // }
    // connection.onerror = error => {
    //     console.log(`WebSocket error: ${error}`)
    // }
});
parser.on('data', line => {
    // connection.send(JSON.stringify({
    //     secret: "spbgos5QpJkp4ghuDtKH7g1FF8M7jsW46qieRR3ZLsjRp3h2LOWbl46Mn99z4DZI",
    //     name: "asd"
    // }))
    line.split("");
    console.log('line.split(""): ', line.split(""));
});
port.on("close", (data) => {
    console.log("Port closed");
    console.log('data: ', data);
});
port.on("error", (data) => {
    console.log('Error on port');
    console.log('data: ', data);
});
port.write('Hello\n');

// const timerrrr = setInterval( () => {
// 	exec( "cat /sys/class/thermal/thermal_zone0/temp", ( error, stdout, stderr ) => {
// 		if ( error ) {
// 			console.log( `error: ${ error.message }` );
// 			return;
// 		}
// 		console.log( parseInt( stdout.split( "\n" )[ 0 ], 10 ) / 1000 );
// 	} );
// }, 500 );
