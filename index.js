const { exec } = require("child_process");

for (let i=0;i<=10;i++){
	exec("sensors", (error, stdout, stderr) => {
	    if (error) {
	        console.log(`error: ${error.message}`);
	        return;
	    }
	    if (stderr) {
	        console.log(`stderr: ${stderr}`);
	        return;
	    }
	    console.log(`stdout: ${stdout}`);
	});	
}
