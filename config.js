let config = {
    processes: [
        {
            short: "ww",
            long: "watering",
            title: "Поливной насос",
            isAvailable: true,
            timings: [
                [[7], [7, 15]],
                [[9, 15], [9, 30]],
                [[11, 30], [11, 45]],
                [[13, 45], [14]],
                [[16], [16, 15]],
                [[18, 15], [18, 30]],
                [[20, 30], [20, 45]],
                [[22, 45], [23]],
            ]
        },
        {
            short: "ll",
            long: "lighting",
            title: "Освещение",
            isAvailable: true,
            timings: [
                [[7], [23]],
            ]
        },
        {
            short: "oo",
            long: "oxidation",
            title: "Аэрация раствора",
            isAvailable: true,
            timings: [
                [[6,45], [7, 15]],
                [[9], [9, 30]],
                [[11, 15], [11, 45]],
                [[13, 30], [14]],
                [[15,45], [16, 15]],
                [[18], [18, 30]],
                [[20, 15], [20, 45]],
                [[22, 30], [23]],
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
            title: "Температура воздуха",
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
exports.config = config;
