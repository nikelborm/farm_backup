const { shouldProcessBeActive } = require("./shouldProcessBeActive");
function createProcessesStatesPackage( processes ) {
    let processStates = {};
    for ( const process of processes ) {
        if ( !process.isAvailable ) continue;
        processStates[ process.long ] = shouldProcessBeActive( process );
    }
    return processStates;
}
exports.createProcessesStatesPackage = createProcessesStatesPackage;
