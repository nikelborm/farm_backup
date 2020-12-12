const { exec } = require("child_process");
const WebSocket = require("ws");
const timerrrr = setInterval( () => {
	exec( "cat /sys/class/thermal/thermal_zone0/temp", ( error, stdout, stderr ) => {
		if ( error ) {
			console.log( `error: ${ error.message }` );
			return;
		}
		console.log( parseInt( stdout.split( "\n" )[ 0 ], 10 ) / 1000 );
	} );
}, 500 );
