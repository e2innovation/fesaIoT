class App {
    constructor() {
        this.initLibraries()
        console.log("App constructor has been finished.")
    }

    initLibraries(){
        this.can = require('socketcan')
        this.core = require('./core')
        this.kcd = require('./library.js')
        this.network = this.kcd.parseKcdFile(__dirname + '/../db/example_db.kcd')
        this.logger = require('./logger.js').logger;
        this.candump = require('./candump.js').candump;
        this.influx = require('./influx.js');
        this.influxDBClient = require('@influxdata/influxdb-client');
        this.path = require('path');
        this.fs = require('fs');
        this.fsp = require('fs').promises;
        this.configFile = require("../config.json")
        // this.alarmConfigFile = require("../../shared-folder/config/alarm.json")
        // this.lockfile = require('proper-lockfile')
        this.mqtt = require('mqtt');
    }

    start() {
        setTimeout(async () => {
            this.influx = new this.influx(this.path, this.logger, this.configFile, this.influxDBClient)
            this.logger.info('Starting Application');
            try {
                this.Core = new this.core(this.configFile,
                                          this.can,
                                          this.network,
                                          this.logger,
                                          this.candump,
                                          this.mqtt,
                                          this.influx,
                                          this.path,
                                          this.fs)
                
                this.logger.info("---------------------------------------");
                this.logger.info(" CANBUS Reader Application started successfully ");
                this.logger.info("---------------------------------------");
                this.logger.info(this.configFile['program-reading'].canPort + ' port has been opened');
                this.Core.start()
            } catch (error) {
                this.logger.info(`Error while setting up the app: ${error}`)
            }
        }, 5000)
    }
}

// Crear y arrancar la aplicación
const app = new App();
app.start();