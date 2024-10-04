class Influx {
    constructor(path, logger, configFile, influxDBClient) {
        
        this.initializeVariables(path, logger, configFile, influxDBClient)
        this.printLog('Influx constructor has finished.');
        console.log('Influx constructor has finished.');
    }

    initializeVariables(path, logger, configFile, influxDBClient){
        this.path = path
        this.logger = logger
        this.configFile = configFile
        this.influxDBClient = influxDBClient

        const { InfluxDB, Point } = this.influxDBClient
        this.InfluxDB = InfluxDB
        this.Point = Point

        let url = this.configFile["Influx"].INFLUX_URL;
        let token = this.configFile["Influx"].INFLUX_TOKEN;
        this.org = this.configFile["Influx"].INFLUX_ORG;
        // this.bucket = this.configFile["Influx"].INFLUX_BUCKET;
        this.bucket = this.configFile["Influx"].INFLUX_TEST_BUCKET;

        this.client = new this.InfluxDB({ url, token });
        this.writeApi = this.client.getWriteApi(this.org, this.bucket);
        this.queryApi = this.client.getQueryApi(this.org);
    }

    printLog(msglog) {
        this.logger.info(msglog);
    }

    toUTCMinus5(date) {
        const utcDate = new Date(date);
        const utcMinus5Date = new Date(utcDate.getTime() - 5 * 60 * 60 * 1000);
        return utcMinus5Date;
    }

    writeData(timestamp, deviceId, data) {
        const points = []
        // const adjustedTimestamp = new Date(timestamp).getTime() * 1000000; // nanosegundos UTC
        // const adjustedTimestamp = timestamp * 1000000000; // de segundo a nanosegundos
        const adjustedTimestamp = timestamp * 1000000

        for(const parameterName in data) {
            const value = data[parameterName]
            const point = new this.Point(parameterName)
                .tag('device_ID', deviceId)
                .timestamp(adjustedTimestamp)
                .floatField('value', value);
            points.push(point)
        }

        // console.log(points)
        
        try {
            this.writeApi.writePoints(points);
            this.printLog('Data has been saved into InfluxDB.' + '\n');
        } catch (e) {
            this.printLog(e);
            this.printLog('WRITE ERROR' + '\n');
        }
    }

    async readData(start, stop) {
        const query = `from(bucket: "${this.bucket}")
            |> range(start: ${start}, stop: ${stop})`;
        try {
            const rows = [];
            for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
            const o = tableMeta.toObject(values);
            o._time = new Date(o._time).toISOString();  // UTC
            rows.push(o);
            }
            // Ajuste a UTC−5
            const adjustedRows = rows.map(row => ({
            ...row,
            _start: this.toUTCMinus5(row._start).toISOString(),
            _stop: this.toUTCMinus5(row._stop).toISOString(),
            _time: this.toUTCMinus5(row._time).toISOString()
            }));
            // console.log(adjustedRows);
            return adjustedRows;
        } catch (error) {
            //console.error(error);
            this.printLog(error)
            this.printLog('READ ERROR' + '\n')
        }
    }

    closeWriteApi() {
        return this.writeApi.close()
            .then(() => {
                this.printLog('WRITE API CLOSED' + '\n');
            })
            .catch((e) => {
                this.printLog(e);
                this.printLog('WRITE API CLOSE ERROR' + '\n');
            });
    }
}

module.exports = Influx
