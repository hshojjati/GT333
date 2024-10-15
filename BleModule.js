/* eslint-disable prettier/prettier */
import {Platform, NativeModules, NativeEventEmitter,NativeAppEventEmitter} from 'react-native';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
//pass NativeAppEventEmitter.addListener The method of adding monitoring is officially not recommended.
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class BleModule {
  constructor() {
    this.isConnecting = false; //Is Bluetooth connected?
    this.bluetoothState = 'off'; //Bluetooth on status
    this.initUUID();
  }
  addListener(str, fun) {
    return bleManagerEmitter.addListener(str, fun);
  }



  /**
   * Init the module.
   * */
  start() {
    BleManager.start({showAlert: false})
      .then(() => {
        this.checkState();
       console.log('Init the module success.');
      })
      .catch(error => {
        console.log('Init the module fail.');
      });
  }

  /**
   * Force the module to check the state of BLE and trigger a BleManagerDidUpdateState event.
   * */
  checkState() {
    BleManager.checkState();
  }

  /**
   * Scan for availables peripherals.
   * */
  scan() {
    return new Promise((resolve, reject) => {
      BleManager.scan([], 12, false)
        .then(() => {
         console.log('Scan started');
          resolve();
        })
        .catch(err => {
          console.log('Scan started fail');
          reject(err);
        });
    });
  }

  /**
   * Stop the scanning.
   * */
  stopScan() {
    BleManager.stopScan()
      .then(() => {
      //  console.log('Scan stopped');
      })
      .catch(err => {
        console.log('Scan stopped fail', err);
      });
  }

  /**
   * Return the discovered peripherals after a scan.
   * */
  getDiscoveredPeripherals() {
    return new Promise((resolve, reject) => {
      BleManager.getDiscoveredPeripherals([])
        .then(peripheralsArray => {
         console.log('Discovered peripherals: ', peripheralsArray);
          resolve(peripheralsArray);
        })
        .catch(error => {
          console.log(error)
        });
    });
  }

  /**
   * Converts UUID to full 128bit.
   *
   * @param {UUID} uuid 16bit, 32bit or 128bit UUID.
   * @returns {UUID} 128bit UUID.
   */
  fullUUID(uuid) {
    if (uuid.length === 4) {
      return '0000' + uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB';
    }
    if (uuid.length === 8) {
      return uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB';
    }
    return uuid.toUpperCase();
  }

  initUUID() {
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];
    this.pclChara= [];
    this.notifyChara= [];
    this.writeChara= [];

    this.BGM_UUID_FEE1 = '0000FEE1-0000-1000-8000-00805F9B34FB';
    this.BGM_UUID_FEE2 = '0000FEE2-0000-1000-8000-00805F9B34FB';
    this.BGM_UUID_FEE3 = '0000FEE3-0000-1000-8000-00805F9B34FB';
  }

  //acquisition Notify、Read、Write、WriteWithoutResponse of serviceUUID和characteristicUUID
  getUUID(peripheralInfo) {
    this.readServiceUUID = [];
    this.readCharacteristicUUID = [];
    this.writeWithResponseServiceUUID = [];
    this.writeWithResponseCharacteristicUUID = [];
    this.writeWithoutResponseServiceUUID = [];
    this.writeWithoutResponseCharacteristicUUID = [];
    this.nofityServiceUUID = [];
    this.nofityCharacteristicUUID = [];
    this.pclChara= [];
    this.notifyChara= [];
    this.writeChara= [];
    for (let item of peripheralInfo.characteristics) {
      item.service = this.fullUUID(item.service);
      item.characteristic = this.fullUUID(item.characteristic);
      if (Platform.OS == 'android') {
        if (item.properties.Notify == 'Notify' || item.properties.Indicate =='Indicate') {
          this.nofityServiceUUID.push(item.service);
          this.nofityCharacteristicUUID.push(item.characteristic);
        }
        if (item.properties.Read == 'Read') {
          this.readServiceUUID.push(item.service);
          this.readCharacteristicUUID.push(item.characteristic);
        }
        if (item.properties.Write == 'Write') {
          this.writeWithResponseServiceUUID.push(item.service);
          this.writeWithResponseCharacteristicUUID.push(item.characteristic);
        }
        if (item.properties.WriteWithoutResponse == 'WriteWithoutResponse') {
          this.writeWithoutResponseServiceUUID.push(item.service);
          this.writeWithoutResponseCharacteristicUUID.push(item.characteristic);
        }

        switch (item.characteristic) {
          case this.BGM_UUID_FEE1:
              if(!this.pclChara.includes(item))
                this.pclChara.push(item);
              break;
          case this.BGM_UUID_FEE2:
            if(!this.notifyChara.includes(item))
                this.notifyChara.push(item);
              break;
          case this.BGM_UUID_FEE3:
            if(!this.writeChara.includes(item))
                this.writeChara.push(item);
              break;
      }
      } else {
        //ios
        for (let property of item.properties) {
          if (property == 'Notify') {
            this.nofityServiceUUID.push(item.service);
            this.nofityCharacteristicUUID.push(item.characteristic);
          }
          if (property == 'Read') {
            this.readServiceUUID.push(item.service);
            this.readCharacteristicUUID.push(item.characteristic);
          }
          if (property == 'Write') {
            this.writeWithResponseServiceUUID.push(item.service);
            this.writeWithResponseCharacteristicUUID.push(item.characteristic);
          }
          if (property == 'WriteWithoutResponse') {
            this.writeWithoutResponseServiceUUID.push(item.service);
            this.writeWithoutResponseCharacteristicUUID.push(
              item.characteristic,
            );
          }
        }
      }
    }
  }

  /**
   * Attempts to connect to a peripheral.
   * */
  connect(id) {
    this.isConnecting = true; //Bluetooth is currently connecting
    return new Promise((resolve, reject) => {
      BleManager.connect(id)
        .then(() => {
         // console.log('Connected success.');
          return BleManager.retrieveServices(id);
        })
        .then(peripheralInfo => {
          this.peripheralId = peripheralInfo.id;
          this.getUUID(peripheralInfo);
          this.isConnecting = false; //The current Bluetooth connection ends
          resolve(peripheralInfo);
        })
        .catch(error => {
          console.log('Connected error:', error);
          this.isConnecting = false; //The current Bluetooth connection ends
          reject(error);
        });
    });
  }

  /**
   * Disconnect from a peripheral.
   * */
  disconnect() {
    BleManager.disconnect(this.peripheralId)
      .then(() => {
       // console.log('Disconnected');
      })
      .catch(error => {
        console.log('Disconnected error:', error);
      });
  }

  /**
   * Start the notification on the specified characteristic.
   * */
  startNotification() {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.nofityServiceUUID.length; i++) {
        setTimeout(async () => {
          try {
              BleManager.startNotification(
              this.peripheralId,
              this.nofityServiceUUID[i],
              this.nofityCharacteristicUUID[i],
            )
              .then(() => {
                console.log('Notification started');
               // resolve();
              })
              .catch(error => {
                console.log('Notification error:', error);
               // reject(error);
              });
          }
          catch (err) {

          }
        }, i * 1000);
      }
    });
  }

  stopNotification2() {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.nofityServiceUUID.length; i++) {
        setTimeout(async () => {
          try {
              BleManager.stopNotification(
              this.peripheralId,
              this.nofityServiceUUID[i],
              this.nofityCharacteristicUUID[i],
            )
              .then(() => {
                console.log('Notification stopped');
               // resolve();
              })
              .catch(error => {
                console.log('Notification error:', error);
               // reject(error);
              });
          }
          catch (err) {

          }
        }, i * 1000);
      }
    });
  }


  /**
   * Turn off notifications
   * Stop the notification on the specified characteristic.
   * */
  stopNotification(index = 0) {
    BleManager.stopNotification(
      this.peripheralId,
      this.nofityServiceUUID[index],
      this.nofityCharacteristicUUID[index],
    )
      .then(() => {
      //  console.log('stopNotification success!');
        //resolve();
      })
      .catch(error => {
        console.log('stopNotification error:', error);
        //reject(error);
    });
  }

  /**
   * Send data to Bluetooth, no response
   * Parameters:(peripheralId, serviceUUID, characteristicUUID, data, maxByteSize)
   * Write without response to the specified characteristic, you need to call retrieveServices method before.
   * */
  writeWithoutResponseBytes(data) {
    console.log('writeWithoutResponseServiceUUID length:', writeWithoutResponseServiceUUID.length);
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.writeWithoutResponseServiceUUID.length; i++) {
        console.log(`writing cmd:${data} to: ${this.writeWithoutResponseServiceUUID[index]}`);
        setTimeout(async () => {
              BleManager.writeWithoutResponse(
              this.peripheralId,
              this.writeWithoutResponseServiceUUID[i],
              this.writeWithoutResponseCharacteristicUUID[i],
              data
            )
              .then(() => {
              })
              .catch(error => {
                console.log('writeWithoutResponseBytes error:', error);
              });
        }, i * 1000);
      }

      
    });
  }

  write(data) {
    console.log('write ServiceUUID length:', writeWithoutResponseServiceUUID.length);
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.writeWithoutResponseServiceUUID.length; i++) {
        console.log(`writing cmd:${data} to: ${this.writeWithoutResponseServiceUUID[index]}`);
        setTimeout(async () => {
              BleManager.write(
              this.peripheralId,
              this.writeWithoutResponseServiceUUID[i],
              this.writeWithoutResponseCharacteristicUUID[i],
              data
            )
              .then(() => {
              })
              .catch(error => {
                console.log('write error:', error);
              });
        }, i * 1000);
      }

      
    });
  }

  /**
   * Read data
   * Read the current value of the specified characteristic, you need to call retrieveServices method before
   * */

  read(index = 0) {
    return new Promise((resolve, reject) => {
      BleManager.read(
        this.peripheralId,
        this.readServiceUUID[index],
        this.readCharacteristicUUID[index],
      )
        .then(data => {
          resolve(data);
        })
        .catch(error => {
         // console.log(error);
          reject(error);
        });
    });
  }

  /**
   * Returns connected Bluetooth devices
   * Return the connected peripherals.
   * */
  async getConnectedPeripherals() {
      try {
          var ff = [];
      const peripheralsArray = await BleManager.getConnectedPeripherals([]);
      return peripheralsArray;
      } catch (error) { }
      return ff;
  }

  /**
   * Determine whether the specified device is connected
   * Check whether a specific peripheral is connected and return true or false
   */
  isPeripheralConnected() {
    return new Promise((resolve, reject) => {
      BleManager.isPeripheralConnected(this.peripheralId, [])
        .then(isConnected => {
          resolve(isConnected);
          if (isConnected) {
              return true;
          } else {
              return false;
          }
        })
        .catch(error => {
          //reject(error);
            return false;
        });
    });
  }

  /**
   * Bluetooth received signal strength
   * Read the current value of the RSSI
   * */
  readRSSI(id) {
    return new Promise((resolve, reject) => {
      BleManager.readRSSI(id)
        .then(rssi => {
        //  console.log(id, 'RSSI: ', rssi);
          resolve(rssi);
        })
        .catch(error => {
         // console.log(error);
          reject(error);
        });
    });
  }

  /**
   * Turn on Bluetooth(Android only)
   * Create the request to the user to activate the bluetooth
   * */
  enableBluetooth() {
    BleManager.enableBluetooth()
      .then(() => {
        this.start();
       console.log('The bluetooh is already enabled or the user confirm');
      })
      .catch(error => {
        console.log('The user refuse to enable bluetooth');
      });
  }

  /**
   * Android only
   * Start a process that binds the remote device
   * Start the bonding (pairing) process with the remote device
   * */
  createBond(id) {
    BleManager.createBond(id)
      .then(() => {
        return true;
     //   console.log('createBond success or there is already an existing one');
      })
      .catch(() => { 
        console.log('fail to bond');
        return false;
      });
  }

  write_pclChara(cmd) {
    console.log('write_pclChara: ',cmd);
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.pclChara.length; i++) {
        setTimeout(async () => {
              BleManager.write(
              this.peripheralId,
              this.pclChara[i].service,
              this.pclChara[i].characteristic,
              cmd
            )
              .then(() => {
                //setTimeout(() => this.readCharacteristic(this.state.pclChara), 1000)
              })
              .catch(error => {
                console.log('write_pclChara error:', error);
              });
        }, i * 1000);
      }
      });
  }

  read_pclChara() {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.pclChara.length; i++) {
        BleManager.read(
          this.peripheralId,
          this.pclChara[i].service,
          this.pclChara[i].characteristic
      )
      .then(data => {
        resolve(data);
      })
        .catch(error => {
          console.log('read_pclChara error:', error);
        });
      }
      });
  }

  write_writeChara(cmd) {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.writeChara.length; i++) {
        setTimeout(async () => {
              BleManager.write(
              this.peripheralId,
              this.writeChara[i].service,
              this.writeChara[i].characteristic,
              cmd
            )
              .then(() => {
                resolve();
              })
              .catch(error => {
                console.log('write_writeChara error:', error);
              });
        }, i * 500);
      }
      });
  }

  startNotification_Chara() {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.notifyChara.length; i++) {
        setTimeout(async () => {
              BleManager.startNotification(
              this.peripheralId,
              this.notifyChara[i].service,
              this.notifyChara[i].characteristic
            )
              .then(() => {
                console.log('notification started');
                resolve();
              })
              .catch(error => {
                console.log('startNotification_Chara error:', error);
                reject(error);
              });
        }, i * 500);
      }
      });
  }

  stopNotification_Chara() {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.notifyChara.length; i++) {
        setTimeout(async () => {
              BleManager.stopNotification(
              this.peripheralId,
              this.notifyChara[i].service,
              this.notifyChara[i].characteristic
            )
              .then(() => {
                console.log('notification stopped');
                resolve();
              })
              .catch(error => {
                console.log('stopNotification_Chara error:', error);
                reject(error);
              });
        }, i * 500);
      }
      });
  }
}
