const util = require('util');
const EventEmitter = require('events');
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

    this.emmiter = EventEmitter.call(this);
    this.oldEmitFunc = this.emit;

    this.emit = (event, ...args) => {
        try {
            return this.oldEmitFunc(event, args);
        } catch (err) {
            if (this.listenerCount()) {
                console.error('Failed to emit event. Error :  ', err);
            } else {
                console.error('Failed to emit event. All Listeners are removed. Error : ', err);
            }
        }
    };

    this.deviceSettings = settings;

    this.FTDIDevice = new FTDIDevice(settings);
}

// FtdiDevice.prototype.emit = (event , ...args ) =>{
//     console.log( '********' , event)
//     try {
//         return this.oldParentFunction(event, args);
//     } catch (err) {
//         console.error( 'Failed to emit event. Might be that all Listeners are removed ', err )
//     }
// };

util.inherits(FtdiDevice, EventEmitter);

/**
 * The open mechanism of the device.
 * On opened 'open' will be emitted and the callback will be called.
 * On error 'error' will be emitted and the callback will be called.
 */
FtdiDevice.prototype.open = function (settings) {
    var self = this;

    if (typeof (settings.bitmode) === 'string') {
        settings.bitmode = bitmodes[settings.bitmode];
    }

    this.connectionSettings = settings;
    // this.on('error', function (err) {
    //     self.close();
    // });
    this.isClosing = false;
    const rePromise = new Promise((resolve, reject) => {
        let promiseHandled = false;
        this.FTDIDevice.open(this.connectionSettings, function (err, data) {
            if (err) {
                self.emit('error', err);
                if (!promiseHandled) reject(err);
            } else {
                self.emit('data', data);
            }
        }, function (err) {
            if (err) {
                self.emit('error', err);
                reject(err);
            } else {
                self.emit('open');
                resolve();
            }
            promiseHandled = true;
        });
    });
    return rePromise;
};

/**
 * The write mechanism.
 * @param  {Array || Buffer} data     The data, that should be sent to device.
 * On error 'error' will be emitted and the callback will be called.
 */
FtdiDevice.prototype.write = function (data) {
    if (!Buffer.isBuffer(data)) {
        data = Buffer.from(data);
    }
    const self = this;
    const retPromise = new Promise((resolve, reject) => {
        this.FTDIDevice.write(data, function (err) {
            if (err) {
                self.emit('error', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
    return retPromise;
};

/**
 * The close mechanism of the device.
 * On closed 'close' will be emitted and the callback will be called.
 * On error 'error' will be emitted and the callback will be called.
 */
FtdiDevice.prototype.close = function () {
    const retPromise = new Promise((resolve, reject) => {
        const self = this;
        if (this.isClosing) {
            reject(new Error('Device already closed'));
            return;
        }
        this.isClosing = true;
        this.FTDIDevice.close(function (err) {
            if (err) {
                self.emit('error', err);
                reject(err);
            } else {
                self.emit('close');
                resolve();
            }
            self.removeAllListeners();
        });
    });
    return retPromise;
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
 */
const writeToDevice = (aFtdiDevice, aData) => {
    return aFtdiDevice.write(aData);
};

/**
 *
 * @param {FtdiDevice} aFtdiDevice
 */
const openDevice = (aFtdiDevice) => {
    return aFtdiDevice.open({
        baudrate: 9600,
        databits: 8,
        stopbits: 1,
        parity: 'none',
        bitmode: bitmodes.sync, // for bit bang
        bitmask: 0xff    // for bit bang
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

    openDevice: (aFtdiDevice) => {
        return openDevice(aFtdiDevice);
    },

    // TO DO - solve issue when trying to close already closed
    closeDevice: (aFtdiDevice) => {
        return aFtdiDevice.close();
    },

    /**
     *
     * @param {FtdiDevice} aFtdiDevice
     * @param {Array} aPortsOnArray
     *          Must be 4 or 8 with 0 or 1 content
     * @param {(err)=>()} aCallback
     */
    switchPorts: (aFtdiDevice, aPortsOnArray) => {
        if (!aFtdiDevice) {
            return Promise.reject(new Error('Invalid aFtdiDevice input')) ;
        }
        if (!aPortsOnArray || !Array.isArray(aPortsOnArray)) {
            return Promise.reject(new Error('Invalid aPortsOnArray input')) ;
        }
        const portsLength = aPortsOnArray.length;
        if (!(portsLength === 4 || portsLength === 8) || aPortsOnArray.some(v => !(v === 0 || v === 1))) {
            return Promise.reject(new Error('Invalid aPortsOnArray input; Must be 4/8 length and contain only 1/0 data')) ;
        }

        const data = convertPortsOnArrayToData(aPortsOnArray);

        // console.log('aaaaa', data.);

        return writeToDevice(aFtdiDevice, [data]);

    },

    switchAllPorts: (aFtdiDevice, aIsOn, aCallback) => {
        if (!aFtdiDevice) {
            return Promise.reject(new Error('Invalid aFtdiDevice input'));
        }

        return writeToDevice(aFtdiDevice, aIsOn ? [0xff] : [0x00]);
    }

};
