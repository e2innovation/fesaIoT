var fs = require('fs');
var xml2js = require('xml2js');
var decrypt = require('./encryption/decryptDB');

//-----------------------------------------------------------------------------
function get_signal_from_xml(signal, value, labelset) {
    var _s = {
        name: signal.name,
        //nameOrder: signal.nameOrder,
        bitLength: signal.length ? parseFloat(signal.length) : 1,
        endianess: signal.endianess ? signal.endianess : 'little',
        spn: signal.spn,
        labels: {},
    }

    // add Values from the database
    if (Array.isArray(value)) {
        _s.slope = value[0]['$'].slope ? parseFloat(value[0]['$'].slope) : 1.0;
        _s.intercept = value[0]['$'].intercept ? parseFloat(value[0]['$'].intercept) : 0.0;
        _s.unit = value[0]['$'].unit ? value[0]['$'].unit : "";
        _s.minValue = value[0]['$'].min ? value[0]['$'].min : undefined;
        _s.maxValue = value[0]['$'].max ? value[0]['$'].max : undefined;
        _s.type = value[0]['$'].type ? value[0]['$'].type : "unsigned";
        _s.description = value[0]['$'].description ? value[0]['$'].description : "unsigned";
        _s.machine_identifier = value[0]['$'].machine_identifier ? value[0]['$'].machine_identifier : "unsigned";
        _s.dataPosition = value[0]['$'].dataPosition ? value[0]['$'].dataPosition : "unsigned";
        _s.MeasureValueType = value[0]['$'].MeasureValueType ? value[0]['$'].MeasureValueType : "DOUBLE";
        _s.factor = value[0]['$'].factor ? parseFloat(value[0]['$'].factor) : 0.0;
        _s.offvalue = value[0]['$'].offvalue ? parseFloat(value[0]['$'].offvalue) : 0.0;
        _s.defaultValue = value[0]['$'].defaultValue ? parseFloat(value[0]['$'].defaultValue) : 0.0;

        _s.lowerLimit = value[0]['$'].lowerLimit ? parseFloat(value[0]['$'].lowerLimit) : undefined;
        _s.upperLimit = value[0]['$'].upperLimit ? parseFloat(value[0]['$'].upperLimit) : undefined;
    }

    // add label sets from the database.
    if (Array.isArray(labelset)) {
        var labels = labelset[0]['Label'];
        if (labels != undefined) {
            for (var i = 0; i < labels.length; i++) {
                //_s.labels[labels[i]['$'].value] = labels[i]['$'].name;
                _s.labels[labels[i]['$'].value] = labels[i]['$'].name[i];
            }
        }
    }

    _s.bitOffset = parseFloat(signal.offset);

    return _s
}

exports.parseKcdFile = function (file) {
    var result = {}; // Result will be a dictionary describing the whole network
    // var dataEncrypted = fs.readFileSync(file);
    // var data = decrypt.decrypt(dataEncrypted.toString());
    // fs.appendFileSync(file, data, (error) => {});
 
    var data = fs.readFileSync(file);
    // console.log(data.toString());

    // Convert the data to a string if necessary
    // const jsonData = JSON.stringify(data.toString(), null, 2);

    // Write the JSON data to a file
    // fs.writeFile('output.kcd', data.toString(), (err) => {
    // if (err) {
    //     console.error('Error writing file:', err);
    // } else {
    //     console.log('File has been saved successfully!');
    // }
    // });

    var parser = new xml2js.Parser({ explicitArray: true });

    parser.parseString(data, function (e, i) {
        result.nodes = {};

        var d = i['NetworkDefinition'];

        for (n in d['Node']) {
            var node = d['Node'][n]['$'];

            result.nodes[node['id']] = {};
            result.nodes[node['id']].name = node['name'];
            result.nodes[node['id']].position = node['position'];
            result.nodes[node['id']].buses = {};
            result.nodes[node['id']].device = node['device'];
            result.nodes[node['id']].J1939 = {
                'AAC': node['J1939AAC'],
                'Function': node['J1939Function'],
                'Vehicle': node['J1939Vehicle'],
                'Identity': node['J1939IdentityNumber'],
                'Industry': node['J1939IndustryGroup'],
                'System': node['J1939System'],
                'Manufacture': node['J1939ManufacturerCode'],

                getName: function () {
                    var name = Buffer.alloc(8);
                    name[7] = ((this.AAC & 0x1) << 7) | ((this.Industry & 0x7) << 4) | (this.Vehicle & 0xF);
                    name[6] = (this.System) << 1 & 0xFE;
                    name[5] = this.Function & 0xFF;
                    name[4] = 0; // function Instance & ECU instance
                    name[3] = (this.Manufacture >> 3) & 0xFF;
                    name[2] = ((this.Manufacture & 0x7) << 5) | ((this.Identity >> 16) & 0x1F);
                    name[1] = (this.Identity >> 8) & 0xFF;
                    name[0] = this.Identity & 0xFF;
                    return name;
                },
            }
        }

        result.buses = {};
        for (b in d['Bus']) {
            var bus = d['Bus'][b]['$'];

            result.buses[bus['name']] = {};
            var new_bus = result.buses[bus['name']];

            new_bus['messages'] = [];
            for (m in d['Bus'][b]['Message']) {
                var message = d['Bus'][b]['Message'][m]['$'];
                var producers = d['Bus'][b]['Message'][m]['Producer'];

                var multiplex = d['Bus'][b]['Message'][m]['Multiplex'];

                var _m = {
                    name: message.name,
                    id: parseInt(message.id, 16),
                    ext: message.format == 'extended',
                    triggered: message.triggered == 'true',
                    length: message.length ? parseInt(message.length) : 0,
                    interval: message.interval ? parseInt(message.interval) : 0,
                    muxed: (multiplex != undefined),
                    mux: undefined
                };

                // Add messages going out and from whom.
                for (p in producers) {
                    for (n in producers[p]['NodeRef']) {
                        var id = producers[p]['NodeRef'][n]['$']['id'];

                        if (result.nodes[id]) {
                            if (result.nodes[id].buses[bus['name']] == undefined)
                                result.nodes[id].buses[bus['name']] = { produces: [], consumes: [] }

                            result.nodes[id].buses[bus['name']].produces.push(_m.id);
                        }
                    }
                }

                if (!_m.interval)
                    _m.interval = 0;

                new_bus['messages'].push(_m);

                _m.signals = [];

                var maxOffset = 0;

                // look for multiplexed messages
                for (mux in multiplex) {
                    _m.mux = {
                        name: multiplex[mux]['$']['name'],
                        offset: parseInt(multiplex[mux]['$']['offset']),
                        length: parseInt(multiplex[mux]['$']['length'])
                    }

                    for (mg in multiplex[mux]['MuxGroup']) {
                        var muxmsg = multiplex[mux]['MuxGroup'][mg]['$'];

                        for (s in multiplex[mux]['MuxGroup'][mg]['Signal']) {
                            var signal = multiplex[mux]['MuxGroup'][mg]['Signal'][s]['$'];
                            var value = multiplex[mux]['MuxGroup'][mg]['Signal'][s]['Value'];
                            var labelset = multiplex[mux]['MuxGroup'][mg]['Signal'][s]['LabelSet'];

                            var _s = get_signal_from_xml(signal, value, labelset)

                            // Added multiplexor
                            _s.mux = parseInt(muxmsg['count'])

                            _m.signals.push(_s);

                            var offset_num = _s.bitOffset + _s.bitLength;

                            if (offset_num > maxOffset)
                                maxOffset = offset_num;
                        }
                    }

                    // only one muxer supported right now
                    break
                }

                for (s in d['Bus'][b]['Message'][m]['Signal']) {
                    var signal = d['Bus'][b]['Message'][m]['Signal'][s]['$'];
                    var value = d['Bus'][b]['Message'][m]['Signal'][s]['Value'];
                    var labelset = d['Bus'][b]['Message'][m]['Signal'][s]['LabelSet'];
                    var consumers = d['Bus'][b]['Message'][m]['Signal'][s]['Consumer'];

                    var _s = get_signal_from_xml(signal, value, labelset)

                    // Add listeners / targets for the message.
                    for (c in consumers) {
                        for (n in consumers[c]['NodeRef']) {
                            var id = consumers[c]['NodeRef'][n]['$']['id'];

                            if (result.nodes[id]) {
                                if (result.nodes[id].buses[bus['name']] == undefined)
                                    result.nodes[id].buses[bus['name']] = { produces: [], consumes: [] }

                                result.nodes[id].buses[bus['name']].consumes.push({ id: _m.id, signal_name: _s.name });
                            }
                        }
                    }

                    _m.signals.push(_s);

                    var offset_num = _s.bitOffset + _s.bitLength;

                    if (offset_num > maxOffset)
                        maxOffset = offset_num;
                }

                // Calculate length based on define signals
                if (!_m.length) {
                    _m.length = parseInt(maxOffset / 8);

                    if (maxOffset % 8 > 0)
                        _m.length++;
                }
            }
        }
    });

    // NOTE: Not sure if it is safe here to access result, but I guess parsing the XML file is more or less synchronous.

    return result;
}