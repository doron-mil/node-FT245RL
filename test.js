const ftdi = require('./index');

const closeDevice = (aDevice) => {

    return new Promise((resolve, reject) => {
        console.log('1111');
        let promiseFinished = false;
        setTimeout(() => {
            console.log('3333', promiseFinished);
            if (!promiseFinished){
                console.log('444444');
                reject(new Error('probably device already closed'));
            }
        }, 2000);
        ftdi.closeDevice(aDevice, (err) => {
            console.log('2222');
            if (err) {
                console.error('Failed to close', err);
                reject(err);
            } else {
                console.log('Device closed');
                resolve(true);
            }
            promiseFinished = true;

        });
    });
};

ftdi.findFirst().then((device) => {
    device.on('error', function (err) {
        console.log('8888', err);
        return;
    });
    console.log('11111', device);

    // closeDevice(device).then(() => {
    //     console.log('Failed test : No error closing device after close ');
    // }).catch((err) => {
    //     console.error('test success : Failed to close after close', err);
    // });

    ftdi.openDevice(device, (err) => {
        if (err) {
            console.error('Failed to open', err);
            return;
        }
        console.log('Device opened !!!!');

        ftdi.switchAllPorts(device, true, (err) => {
            console.log('All******** ON ');
        });

        setTimeout(() => {

            ftdi.switchAllPorts(device, false, (err) => {
                console.log('All******** OFF ');
            });

            closeDevice(device).then(() => {
                console.log('Success to close device');
            }).catch((err) => {
                console.error('Failed to close', err);
            });

            closeDevice(device).then(() => {
                console.log('Failed test : No error closing device after close ');
            }).catch((err) => {
                console.error('test success : Failed to close after close', err);
            });

        }, 2000);

    });


    return;
}).catch((err) => {
    console.error('ERRRrr', err);
});
