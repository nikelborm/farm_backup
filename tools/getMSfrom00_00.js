function getMSfrom00_00([hours, minutes, seconds, milliseconds])
{
    return ((~~hours * 60 + ~~minutes) * 60 + ~~seconds) * 1000 + ~~milliseconds;
}
exports.getMSfrom00_00 = getMSfrom00_00;
