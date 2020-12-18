function createEmptyProcessesStates(processes) {
    let processStates = {};
    for (const process of processes)
    {
        if (!process.isAvailable)
            continue;
        processStates[process.long] = false;
    }
    return processStates;
}
exports.createEmptyProcessesStates = createEmptyProcessesStates;
