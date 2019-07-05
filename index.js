const util = require('util');
const EventEmitter = require('events').EventEmitter;
const ftdi = require('bindings')('FT245RL.node');
// const ftdi = require('FT245RL');
const FTDIDriver = ftdi.FtdiDriver;
const FTDIDevice = ftdi.FtdiDevice;

/**
 * 0x00 = Reset
 * 0x01 = Asynchronous Bit Bang
 * 0x02 = MPSSE (FT2232, FT2232H, FT4232H and FT232H devices only)
 * 0x04 = Synchronous Bit Bang (FT232R, FT245R, FT2232, FT2232H, FT4232H and FT232H devices only)
 * 0x08 = MCU Host Bus Emulation Mode (FT2232, FT2232H, FT4232H and FT232H devices only)
 * 0x10 = Fast Opto-Isolated Serial Mode (FT2232, FT2232H, FT4232H and FT232H devices only)
 * 0x20 = CBUS Bit Bang Mode (FT232R and FT232H devices only)
 * 0x40 = Single Channel Synchronous 245 FIFO Mode (FT2232H and FT232H devices only)
 */
var bitmodes = {
    'reset': 0x00,
    'async': 0x01,
    'mpsse': 0x02,
    'sync': 0x04,
    'mcu': 0x0B,
    'fast': 0x10,
    'cbus': 0x20,
    'single': 0x40
};

/**
 * FtdiDevice represents your physical device.
 * On error 'error' will be emitted.
 * @param {Object || Number} settings The device settings (locationId, serial, index, description).
 */
function FtdiDevice(settings) {
    if (typeof (settings) === 'number') {
        settings = { index: settings };
    }

    EventEmitter.call(this);

    this.deviceSettings = settings;

    this.FTDIDevice = new FTDIDevice(settings);
}

util.inherits(FtdiDevice, EventEmitter);

/**
 * The open mechanism of the device.
 * On opened 'open' will be emitted and the callback will be called.
 * On error 'error' will be emitted and the callback will be called.
 * @param  {Function} callback The function, that will be called when device is opened. [optional]
 *                             `function(err){}`
 */
FtdiDevice.prototype.open = function (settings, callback) {
    var self = this;

    if (typeof (settings.bitmode) === 'string') {
        settings.bitmode = bitmodes[settings.bitmode];
    }

    this.connectionSettings = settings;
    this.on('error', function (err) {
        self.close();
    });
    this.isClosing = false;
    this.FTDIDevice.open(this.connectionSettings, function (err, data) {
        if (err) {
            self.emit('error', err);
        }
        self.emit('data', data);
    }, function (err) {
        if (err) {
            self.emit('error', err);
        } else {
            self.emit('open');
        }
        if (callback) {
            callback(err);
        }
    });
};

/**
 * The write mechanism.
 * @param  {Array || Buffer} data     The data, that should be sent to device.
 * On error 'error' will be emitted and the callback will be called.
 * @param  {Function}        callback The function, that will be called when data is sent. [optional]
 *                                    `function(err){}`
 */
FtdiDevice.prototype.write = function (data, callback) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data);
    }
    var self = this;
    this.FTDIDevice.write(data, function (err) {
        if (err) {
            self.emit('error', err);
        }
        if (callback) {
            callback(err);
        }
    });
};

/**
 * The close mechanism of the device.
 * On closed 'close' will be emitted and the callback will be called.
 * On error 'error' will be emitted and the callback will be called.
 * @param  {Function} callback The function, that will be called when device is closed. [optional]
 *                             `function(err){}`
 */
FtdiDevice.prototype.close = function (callback) {
    var self = this;
    if (this.isClosing) {
        return;
    }
    this.isClosing = true;
    this.FTDIDevice.close(function (err) {
        if (err) {
            self.emit('error', err);
        } else {
            self.emit('close');
        }
        self.removeAllListeners();
        if (callback) callback(err);
    });
};

/**
 *
 * @param {Array} aPortsOnArray
 */
const convertPortsOnArrayToData = (aPortsOnArray) => {
    let portsOnComputedArray = aPortsOnArray;
    if (aPortsOnArray.length === 4) {
        portsOnComputedArray = aPortsOnArray.flatMap(x => [0, x]);
    }
    const retValue = parseInt(portsOnComputedArray.reverse().join(''), 2);
    return retValue;
};

/**
 *
 * @param {FtdiDevice} aFtdiDevice
 * @param {number} aPortsOnArray
 * @param {(err)=>()} aCallback
 */
const writeToDevice = (aFtdiDevice, aData, aCallback) => {
    aFtdiDevice.write(aData, function (err) {
        aCallback(undefined);
    });
};

/**
 *
 * @param {FtdiDevice} aFtdiDevice
 * @param {(err)=>()} aCallback
 */
const openDevice = (aFtdiDevice, aCallback) => {
    aFtdiDevice.open({
        baudrate: 9600,
        databits: 8,
        stopbits: 1,
        parity: 'none',
        bitmode: bitmodes.sync, // for bit bang
        bitmask: 0xff    // for bit bang
    }, function (err) {

        if (err) {
            aCallback(err);
            return;
        }

        aCallback(undefined);

    });
};

module.exports = {

    FtdiDevice: FtdiDevice,

    /**
     * Calls the callback with an array of found devices.
     * @param  {Number}   vid      The vendor id. [optional]
     * @param  {Number}   pid      The product id. [optional]
     * @param  {Function} callback The function, that will be called when finished finding.
     *                             `function(err, devices){}` devices is an array of device objects.
     */
    find: function (vid, pid, callback) {
        if (arguments.length === 2) {
            callback = pid;
            pid = null;
        } else if (arguments.length === 1) {
            callback = vid;
            vid = null;
            pid = null;
        }

        FTDIDriver.findAll(vid, pid, callback);
    },

    findFirst: () => {
        return new Promise((resolve, reject) => {
            module.exports.find((err, devices) => {
                if (err || !devices || devices.length <= 0) {
                    const errMsg = err ? `Error :${JSON.stringify(err)}` : '';
                    reject(new Error(`No FTDI device found. ${errMsg}`));
                } else {
                    resolve(new FtdiDevice(devices[0]));
                }
            });
        });
    },

    openDevice: (aFtdiDevice, aCallback) => {
        openDevice(aFtdiDevice, aCallback);
    },

    closeDevice: (aFtdiDevice, aCallback) => {
        aFtdiDevice.close();
    },

    /**
     *
     * @param {FtdiDevice} aFtdiDevice
     * @param {Array} aPortsOnArray
     *          Must be 4 or 8 with 0 or 1 content
     * @param {(err)=>()} aCallback
     */
    switchPorts: (aFtdiDevice, aPortsOnArray, aCallback) => {
        if (!aFtdiDevice) {
            aCallback(new Error('Invalid aFtdiDevice input'));
            return;
        }
        if (!aPortsOnArray || !Array.isArray(aPortsOnArray)) {
            aCallback(new Error('Invalid aPortsOnArray input'));
            return;
        }
        const portsLength = aPortsOnArray.length;
        if (!(portsLength === 4 || portsLength === 8) || aPortsOnArray.some(v => !(v === 0 || v === 1))) {
            aCallback(new Error('Invalid aPortsOnArray input; Must be 4/8 length and contain only 1/0 data '));
            return;
        }

        const data = convertPortsOnArrayToData(aPortsOnArray);

        // console.log('aaaaa', data.);

        writeToDevice(aFtdiDevice, [data], aCallback);

    },

    switchAllPorts: (aFtdiDevice, aIsOn, aCallback) => {
        if (!aFtdiDevice) {
            aCallback(new Error('Invalid aFtdiDevice input'));
            return;
        }

        writeToDevice(aFtdiDevice, aIsOn ? [0xff] : [0x00], aCallback);
    }

};
