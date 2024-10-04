class Core {
    constructor(configFile, can, network, logger, candump, mqtt, influx, path, fs) 
    {
        this.configFile = configFile
        this.can = can;
        this.channel = this.can.createRawChannel(this.configFile["program-reading"].canPort, true);
        this.network = network;
        this.logger = logger;
        this.candump = candump;
        this.mqtt = mqtt;
        this.influx = influx;
        this.path = path;
        this.fs = fs;
        this.timerChannel = null;
        this.initializeVariables()
        this.printLog('Core constructor has finished.');
    }

    initializeVariables(){
        this.canMsgId = null
        this.dataSend = {}

        //Variables to dave data into InfluxDB
        this.dataBuffer = []
        this.dataJson = {}
        
        this.message = null
        this.obj = null
        this.ctr = null
        this.val = null
        this.max = null
        this.min = null

        this.valuesMap = new Map();
        this.valuesMapAlertList = new Map();
        this.process = true;

        //Variables for CAN
        this.Source_Address = null;
        this.CANDATAnum = 0;
        this.CANdata = 0;
        this.CANDATA_split = 0;
        this.CANDATAstringBIN_complete = "";
        this.CANDATAstringBIN_total = "";
        this.v = 0
        this.CANDATAnumDEC = 0;
        this.CANDATAstringBIN = "";
        this.z = 0;
        this.CANDATAstringBIN_cutted = "";
        this.CANDATAnumDEC_cutted = 0;
        this.CANDATAstringHEX_cutted = "";
        this.CANDATAstringHEX_cutted_upperCase = "";
        this.CANDATAnum = 0;

        this.spn = null;
        this.timestamp = null;

        console.log(this.configFile);
        this.localhost = this.configFile["program-sending"]["mqtt"].localhost

        this.connectLocalBroker();
    }

    printCandump(msgCan){
        this.candump.info(msgCan);
    }

    printLog(msglog) {
        this.logger.info(msglog);
    }

    connectLocalBroker(){
        this.mqttClient = this.mqtt.connect('mqtt://' + this.localhost + ':1883');
        // this.mqttClient = this.mqtt.connect('mqtt://192.168.1.238:1883');

        this.mqttClient.on('connect', () => {
            this.printLog('Connected to MQTT broker');
            console.log('Connected to MQTT broker');
        });

        this.mqttClient.on('error', (err) => {
            console.error('MQTT client error: ' + err);
        });
    }

    jsonArgs(obj, count, data){
        this.obj = obj
        this.ctr = count
        //this.unit = this.network.buses.canBus.messages[obj].signals[this.ctr].unit
        //this.MeasureValueType = this.network.buses.canBus.messages[obj].signals[this.ctr].MeasureValueType
        this.off = this.network.buses.canBus.messages[this.obj].signals[this.ctr].bitOffset
        this.lth = this.network.buses.canBus.messages[this.obj].signals[this.ctr].bitLength

        this.max = this.network.buses.canBus.messages[this.obj].signals[this.ctr].maxValue
        this.min = this.network.buses.canBus.messages[this.obj].signals[this.ctr].minValue

        if ((Number.isInteger(this.lth) == false) || (Number.isInteger(this.off) == false)) {
            this.CANdata = data.toString("hex");
            this.CANDATA_split = this.CANdata.split('', this.CANdata.length);
            this.CANDATAstringBIN_complete = '';
            this.CANDATAstringBIN_total = '';

            for (this.v = 0; this.v < this.CANdata.length; this.v++) {
                this.CANDATAnumDEC = parseInt(this.CANDATA_split[this.v], 16);
                this.CANDATAstringBIN = this.CANDATAnumDEC.toString(2);
                this.CANDATAstringBIN_complete = this.CANDATAstringBIN;

                for (this.z = 0; this.z < 4 - this.CANDATAstringBIN.length; this.z++) {
                    this.CANDATAstringBIN_complete = '0' + this.CANDATAstringBIN_complete;
                }
                this.CANDATAstringBIN = this.CANDATAstringBIN_complete;
                this.CANDATAstringBIN_total = this.CANDATAstringBIN_total + this.CANDATAstringBIN;
            }

            for (this.v = 0; this.v < 64 - this.CANDATAstringBIN_total.length; this.v++) {
                this.CANDATAstringBIN_total = '0' + this.CANDATAstringBIN_total;
            }

            this.CANDATAstringBIN_cutted = this.CANDATAstringBIN_total.substring(this.off * 8, this.off * 8 + this.lth * 8);
            this.CANDATAnumDEC_cutted = parseInt(this.CANDATAstringBIN_cutted, 2);
            this.CANDATAstringHEX_cutted = this.CANDATAnumDEC_cutted.toString(16);
            this.CANDATAstringHEX_cutted_upperCase = this.CANDATAstringHEX_cutted.toUpperCase();
            this.CANDATAnum = parseInt(this.CANDATAstringHEX_cutted_upperCase, 16);
            this.val = this.CANDATAnum * 
                       this.network.buses.canBus.messages[this.obj].signals[this.ctr].factor + 
                       this.network.buses.canBus.messages[this.obj].signals[this.ctr].offvalue
        } else {
            this.val = data.readUIntLE(this.off, this.lth) *
                this.network.buses.canBus.messages[this.obj].signals[this.ctr].factor +
                this.network.buses.canBus.messages[this.obj].signals[this.ctr].offvalue
        }
    }

    analyzeData(pgn, buff, timestamp) 
    {
        // let valueTorque = 0.0;
        let obj = 0xFF;
        let name = '';
        let value = 0.0;
        let type = '';
        let dataMap = {};
        let dataMapAlertList = {};
        let lowerLimit = 0
        let upperLimit = 0
        // let dataSendBuffer = {}

        for (const property in this.network.buses.canBus.messages) {
            if (pgn == this.network.buses.canBus.messages[property].id) {
                //Get the complete PGN Message
                obj = property
                for (const count in this.network.buses.canBus.messages[obj].signals) {
                    
                    //Get name from SPN, Example: "eng_fuel_rate"
                    name = this.network.buses.canBus.messages[obj].signals[count].name
                    //Get value from SPN, Example: "521313"
                    this.spn = this.network.buses.canBus.messages[obj].signals[count].spn;
                    //Get type from SPN, Example: "unsigned"
                    type = this.network.buses.canBus.messages[obj].signals[count].MeasureValueType;
                    //Get lowerLimit from SPN.
                    lowerLimit = this.network.buses.canBus.messages[obj].signals[count].lowerLimit;
                    //Get upperLimit from SPN.
                    upperLimit = this.network.buses.canBus.messages[obj].signals[count].upperLimit;
                    //Set PGN, SPN in order to the value
                    this.jsonArgs(obj, count, buff)
                    value = this.val;

                    if(value < lowerLimit || value > upperLimit){
                        continue
                    }

                    if (this.valuesMap.get(name) == null) {
                        this.valuesMap.set(name, { 'timestamp': timestamp, 'value': value });
                        this.dataSend[name] = value
                        this.printLog('Starting Value-> ' + name + ', Value: ' + value);                   
                    } else {
                        dataMap = this.valuesMap.get(name);

                        //Compare minimum time to update, 600000 ms = 60s
                        if((timestamp - parseInt(dataMap.timestamp)) > 100){
                            this.dataSend[name] = value
                            this.printLog('Update-> ' + name + ', lastValue: ' + dataMap.value + ', newValue: ' + value);
                            dataMap.timestamp = timestamp;
                            dataMap.value = value;
                            this.valuesMap.set(name, dataMap);
                            // this.flagDataSentForBuffer = true
                        } 
                    }
                }
                break;
            }
        }
    }

    buildMsn(msg, timestamp) {
        this.dataSend = {}
        this.dataSend.timestamp = timestamp;
        this.analyzeData(this.PGN, msg.data, timestamp);
        return this.dataSend
    }

    stop() {
        if (this.channel) {
            this.channel.stop();
            this.channel = null;
        }
    }

    resetTimer() {
        clearTimeout(this.timerChannel);
        this.timerChannel = setTimeout(() => {
            this.logger.info('Listener timed out, restarting listener');
            this.stop()
            this.channel = this.can.createRawChannel(this.configFile.canPort, true)
            //this.channel.removeListener("onMessage", this.onMessage.bind(this));
            this.start();
        }, 10000);
    }

    //Function to start
    start() {
        this.resetTimer();
        this.channel.addListener("onMessage", this.onMessage.bind(this));
        this.channel.start();
    }

    //Function in order o save data into InfluxDB
    processData(timestamp, data) {
        // Extraer el ID del dispositivo y los parámetros
        const deviceId = data.device_ID;
        const parameters = Object.keys(data).filter(key => key !== 'Time' && key !== 'device_ID');
        
        parameters.forEach(parameterName => {
            const key = `${deviceId}-${timestamp}-${parameterName}`;
            if(!this.dataBuffer.includes(key)){
                this.dataBuffer.push(key)
                this.dataJson[parameterName] = data[parameterName]
            }            
        });

        this.store(timestamp, deviceId, this.dataJson);
        this.dataJson = {};
        this.dataBuffer = [];
    }

    //Store data into InfluxDB
    store(timestamp, deviceId, data){
        try {
            this.influx.writeData(timestamp, deviceId, data);
            this.printLog('Data stored into InfluxDB successfully!');
        } catch (e) {
            this.printLog('Error storing data into InfluxDB: ' + e.message);
        }
    }

    //Slot to get CAn messages
    onMessage(canMsg) {
        this.timestamp = Date.now();

        // Print into log Can Messages
        this.canMsgId = canMsg.id.toString(16).toUpperCase()
        this.printCandump("("+canMsg.ts_sec.toString()
        +"."+canMsg.ts_usec.toString()+")"+" can0 "
        + (this.canMsgId.length==7?"0"+this.canMsgId:this.canMsgId)+"#"
        +canMsg.data.toString("hex").toUpperCase())

        //Get Can Message
        this.message = canMsg

        //Get PGN and Source Address
        //SAE J1939 29 bits - 8 bytes
        var canMsgHex = this.message.id.toString(16);
        var dataPGN = "";
        var sourceAddress = "";

        //For example 0CFEF5EA, the first 0 not considered -> CFEF5EA,lenght = 7 
        //For example 18FEF600  -> 18FEF600,lenght = 8 
        if (canMsgHex.length > 7) {
            dataPGN = canMsgHex.substring(2, 6);
            sourceAddress = (canMsgHex.substring(6, 9));
        } else {
            dataPGN = canMsgHex.substring(1, 5);
            sourceAddress = (canMsgHex.substring(5, 8));
        }

        this.PGN = Number.parseInt(dataPGN, 16);
        this.Source_Address = Number.parseInt(sourceAddress, 16);
        // this.process = true;

        let finalData = this.buildMsn(this.message, this.timestamp)
        
        const deviceId = 'Andino_X1';

        //Json Data in order to send with MQTT
        const jsonData = {
            Time: 0,
            device_ID: deviceId,
            EngineSpeed: -1
        };

        if (finalData.eng_speed != null) {
            jsonData.Time = finalData.timestamp;
            jsonData.EngineSpeed = finalData.eng_speed;
        }

        // console.log(finalData.type);
        if (Object.keys(finalData).length > 1) {
            //this.printLog('--> Data: ' + JSON.stringify(finalData) + ' has been save <--');
            //Publish data into MQTT
            if (finalData.eng_speed != null) {
                // console.log(jsonData)
                //Save into InfluxDB
                this.processData(jsonData.Time, jsonData);
                this.mqttClient.publish('can/data', JSON.stringify(jsonData), (err) => {
                    if (err) {
                        console.error('Error publishing data: ' + err);
                    } else {
                        // console.log('Data published: ' + JSON.stringify(jsonData));
                    }
                });
            }
        }
        this.resetTimer();
    }
}

module.exports = Core