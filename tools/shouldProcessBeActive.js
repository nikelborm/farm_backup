const { getMSfrom00_00 } = require("./getMSfrom00_00");

function shouldProcessBeActive(process)
{
    const msBefore00_00 = ~~new Date((new Date).toDateString());
    const timeNow = Date.now();
    for (const [beginning, end] of process.timings)
    {
        if (msBefore00_00 + getMSfrom00_00(beginning) <= timeNow && timeNow <= msBefore00_00 + getMSfrom00_00(end))
        {
            return true;
        }
    }
    return false;
}
exports.shouldProcessBeActive = shouldProcessBeActive;
