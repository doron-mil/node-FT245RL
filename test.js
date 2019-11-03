const ftdi = require('./index');

const NO_OF_PORTS = 8;

const setOnDeviceListeners = (aDevice) => {

    aDevice.on('error', function (err) {
        console.log('ON ERROR !!!', err);
        return;
    });
    aDevice.on('open', function () {
        console.log('ON OPEN !!!');
        return;
    });
    aDevice.on('data', function (data) {
        console.log('ON DATA !!!', data);
        return;
    });
    aDevice.on('close', function (data) {
        console.log('ON CLOSE !!!', data);
        return;
    });
    console.log('GO DEVICE !!!', aDevice);
};
const funcMap = [];

// List devices
funcMap[0] = () => {
    ftdi.find((err, devices) => {
        if (err) {
            console.log('Error occurred !!! : ', err);
        } else if (devices) {
            devices.forEach((device) => {
                console.log('Device !!! : ', device);
            });

        }
    });
    ftdi.find(1027, 24577, (err, devices) => {

        if (err) {
            console.log('Error occurred !!! : ', err);
        } else if (!devices || !devices.length) {
            console.log('No devices were found !!! : ');
        } else {
            devices.forEach((device) => {
                console.log('Device !!! : ', device);
            });

        }
    });
};

// Close device without opening
funcMap[1] = () => {
    ftdi.findFirst().then((device) => {
        setOnDeviceListeners(device);

        ftdi.closeDevice(device).then(() => {
            console.log('Failed test : No error closing device after close !!! ');
        }).catch((err) => {
            console.error('test success : Failed to close after close !!!!', err);
        });
    });
};

// Double open , Double close , writing when closed
funcMap[2] = () => {
    ftdi.findFirst().then((device) => {
        setOnDeviceListeners(device);

        ftdi.openDevice(device).then(() => {

            console.log('Device opened !!!!');

            ftdi.switchAllPorts(device, true, (err) => {
                console.log('All******** ON !!!!');
            });


            setTimeout(async () => {

                ftdi.openDevice(device).then(() => {
                    console.error('Success on open device twice -> NOT GOOD !!!!');
                }).catch((err) => {
                    console.log('Failed on open device twice -> Very good !!!! error : ', err);
                });


                await ftdi.switchAllPorts(device, false);

                ftdi.closeDevice(device).then(async () => {
                    console.log('Success to close device');

                    try {
                        await ftdi.switchAllPorts(device, true);
                        //     .then(() => {
                        //     console.error('t111111113333',);
                        // }).catch((e) => {
                        //     console.log(, e);
                        // });
                    } catch (e) {
                        console.error('Success - can\'t wrtite to device closed . Error : ', e);
                    }

                    ftdi.closeDevice(device).then(() => {
                        console.log('Failed test : No error closing device after close ');
                    }).catch((err) => {
                        console.error('test success : Failed to close after close. Error : ', err.message);
                    });

                }).catch((err) => {
                    console.error('Failed to close!!!', err);
                });


            }, 2000);

        }).catch((err) => {
            console.error('Filed on open device !!!!', err);
        });

        return;
    }).catch((err) => {
        console.error('ERRRrr', err);
    });
};

// Iterate ports
funcMap[3] = () => {
    ftdi.findFirst().then((device) => {
        setOnDeviceListeners(device);

        ftdi.openDevice(device).then(() => {
            console.log('Device opened !!!!');

            let counter = 0;
            let intervalHandle = setInterval(() => {

                ftdi.switchAllPorts(device, false).then(() => {
                    console.log('All ports off !!!');
                }).catch((e) => {
                    console.log('Error - All ports off !!!', e);
                });

                const mod = counter % NO_OF_PORTS;
                const bitNumber = 1 << mod;
                const dataArray = Array.from(bitNumber.toString(2).padStart(NO_OF_PORTS, '0'))
                    .map(x => Number.parseInt(x));
                ftdi.switchPorts(device, dataArray).then(() => {
                    console.log(`Port ${mod} is ON !!! dataArray : `, dataArray);
                }).catch((e) => {
                    console.log('Error - All ports off !!!', e);
                });

                counter++;
                if (counter / NO_OF_PORTS >= 2) {
                    clearInterval(intervalHandle);
                    setTimeout(() => {
                        ftdi.switchAllPorts(device, false).then(() => {
                            console.log('All ports off !!!');
                        }).catch((e) => {
                            console.log('Error - All ports off !!!', e);
                        });

                        ftdi.closeDevice(device).then(() => {
                            console.log('Success to close device !!!');
                        }).catch((err) => {
                            console.error('Failed to close!!!', err);
                        });
                    }, 2000);
                }

            }, 1000);

        }).catch((err) => {
            console.error('Device failed to open !!!!');
        });
        return;
    }).catch((err) => {
        console.error('ERRRrr !!!', err);
    });
};


// funcMap[0]();
// funcMap[1]();
// funcMap[2]();
funcMap[3]();
