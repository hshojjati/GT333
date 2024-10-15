import React, { Component } from 'react';
import { Buffer } from 'buffer';
import BleManager from 'react-native-ble-manager';
import {
    Box,
    GluestackUIProvider,
    Heading,
    ImageBackground,
    StatusBar,
    FormControl,
    FormControlLabel,
    FormControlLabelText,
    Input,
    InputField,
    FormControlError,
    FormControlErrorIcon,
    FormControlErrorText,
    AlertCircleIcon,
    Center,
    Link,
    LinkText,
    HStack,
    Button,
    ButtonText,
    ButtonIcon,
    Icon,
    Text,
    ArrowLeftIcon,
    Textarea,
    PhoneIcon,
    TextareaInput,
    ButtonSpinner,
  } from '@gluestack-ui/themed';
import {config} from '@gluestack-ui/config';
import { BurgerMenu } from '../home/Menu';
import {
    StyleSheet,
    TouchableOpacity,
    View,
    Alert,
    PermissionsAndroid,
    ScrollView,
    TouchableHighlight,
    Image,
    Dimensions
} from 'react-native';
import BleModule from './PM6100/BleModule';
import ChartInfoLine from './PM6100/ChartInfoLine';
import DialogList from './PM6100/DialogList';
import SettingsPage from './PM6100/SettingsPage'
import { Signals } from './PM6100/Signals';
import ViewShot from "react-native-view-shot";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFamilyMembers } from '../../components/api/ApiCalls';
import { Spinner } from '@gluestack-ui/themed';
import { Picker } from '@react-native-picker/picker';
import { withNavigation } from 'react-navigation';
import IconBluetoothW from './PM6100/assets/IconBluetoothW';
import { UserRound,  } from 'lucide-react-native';

const BgmCommand = Object.freeze({
    WAIT_NOTIFY: 'WAIT_NOTIFY',
    OPEN_PCL: 'OPEN_PCL',
    GET_MODEL_NAME: 'GET_MODEL_NAME',
    GET_FIRMWARE_VERSION: 'GET_FIRMWARE_VERSION',
    GET_TOTAL_RECORD_COUNT: 'GET_TOTAL_RECORD_COUNT',
    GET_GLUCOSE_RECORD: 'GET_GLUCOSE_RECORD',
    STOP_BROADCAST: 'STOP_BROADCAST',
  });


/*The main page of the program*/
class MainPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            device: null,
            devices: [],
            pairedDevices: [],
            scanning: false,
            showDialog: false,
            connected: false,
            showSettingsDialog:false,
            pageName:'Spo2',
        };
        this.bluetoothReceiveData = [];
        this.bleReceiveData = '';

        this.BluetoothManager = new BleModule();

        this.totalCount=0;
        this.currentCommand;
        this.open_pcl_try_counter=1;
        this.meterSN='';
        this.modelName='';
        this.firmwareVersion='';
        this.totalCount=0;
        this.isOpenPCL=false;
        this.glucoseData = [];
    }
    goBack = () => {
        this.props.navigation.goBack();
      };
    /*Data received from Bluetooth is parsed on this page and each data is stored in its own variable.*/

    //==================================================================================================
    //Check if bluetooth is connected or not
    async CheckBluetoothIsConnected()
    {
        var bleDevices = [];
        try {
            bleDevices = await this.BluetoothManager.getConnectedPeripherals();
        }
        catch (ex) { }
        if (bleDevices == undefined || bleDevices.length == 0) {
           return false;
        }
        return true;
    }
    //==================================================================================================
    async componentDidMount() {
        //If the platform is Android, the permissions must be checked
        if (Platform.OS == 'android') {
            try {
                let granted = await this.requestAccessFineLocationPermission();
                console.log(granted);
            } catch (err) {
                console.log(err);

            }

            try {
                let granted = await this.requestAccessBluetooth();
                console.log(granted)

            } catch (err) {
                console.log(err);

            }
        }
        //Check if bluetooth is connected or not
        isBlueConnected=await this.CheckBluetoothIsConnected();
        if (isBlueConnected) {
            this.setState({
                connected: true
            });
        }
        else {
            this.setState({
                connected: false
            });
        }
        //Received data is parsed in a timer
        setInterval(() => {
                //this.parseBerryMedData();
        }, 10);

        //An event to notice the disconnection of Bluetooth
        var discoverPeripheralListener = this.BluetoothManager.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral);
        this.getClientsFamilyMembers().then(()=>{
            this.setState({
                loadingClients:false
            })
        })
    }
    //==================================================================================================
    //function of disconnection event to notice the disconnection of Bluetooth
    handleDisconnectedPeripheral = (data) => {
        console.log('handleDisconnectedPeripheral:', data);
        this.setState({
            connected: false
        });
    }
    //==================================================================================================
    //get connected bluetooth and update state
    async getBleConnected() {
        let connected = await this.BluetoothManager.getConnectedPeripherals();
        if (connected == undefined || connected.length == 0) {
            this.setState({
                device: null
            });
            return;
        }
        this.setState({
            device: connected[0]
        });
    }
    //==================================================================================================

    discoverUnpairedDevices = async () => {
        try {
            this.setState({ scanning: true });
            try {
                this.scanBleDevices();
            } finally {
            }
        } catch (err) {
            console.log(err);
            this.setState({ scanning: false });
        }
    };
    //==================================================================================================
    async scanBleDevices() {

        //if (this.BluetoothManager.bluetoothState == 'on') {
        var discoverPeripheralListener = this.BluetoothManager.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
        await this.BluetoothManager.scan()
            .then(() => {

            }).catch(err => {

            })

        setTimeout(async () => {
            discoverPeripheralListener.remove();
            this.BluetoothManager.stopScan();
            console.log('scanning: false')
            this.setState({ scanning: false });
        }, 12000);
    }
    //==================================================================================================
    handleDiscoverPeripheral = (data) => {
        let id;
        let macAddress;
        if (Platform.OS == 'android') {
            macAddress = data.id;
            id = macAddress;
        } else {
            //Mac address is not required for ios connection, but Mac address is required for cross-platform identification of the same device
            //If the broadcast carries a Mac address, ios can obtain the Bluetooth Mac address by broadcasting 0x18,
            macAddress = this.BluetoothManager.getMacAddressFromIOS(data);
            id = data.id;
        }
        //  console.log(data);
        if (data.name == null || data.name.length < 2)
            return;

        if (!data.name.toLowerCase().includes('2236'))
           return;

        if (this.state.devices == undefined || this.state.devices.length == 0) {
            let devices1 = [];
            devices1.push(data);
            this.setState({
                devices: devices1
            });
        }

        else {
            let devices1 = this.state.devices;
            let found = false;
            for (let i = 0; i < devices1.length; i++) {
                if (data.id == devices1[i].id) {
                    found = true;
                }
            }
            if (!found) {
                devices1.push(data);
                this.setState({
                    devices: devices1
                });
            }
        }
    }
    //==================================================================================================
    //Connect to the device
    connect = async item => {
        try {

            if (item.id != undefined && item.id.length > 0) {
               // await this.BluetoothManager.createBond(item.id);

                await this.BluetoothManager.connect(item.id)
                    .then(peripheralInfo => {
                        this.setState({ connected: true, device: item });
                        this.CloseCustomAlert()
                    })
                    .catch(_err => {
                        Alert.alert(_err)
                    });

                console.log("startNotification");
                if (this.updateValueListener != undefined)
                    this.updateValueListener.remove();
                this.updateValueListener = this.BluetoothManager.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValue);
                try {
                    this.currentCommand = BgmCommand.WAIT_NOTIFY;
                    await this.BluetoothManager.startNotification()
                        .then(() => {
                            // setIsMonitoring(true);
                            // alert('aaa');
                        })
                        .catch(err => {
                            // setIsMonitoring(false);
                            // alert('bbb');
                        });

                }
                catch (error) {
                    //  console.log(error);
                }
            }
            else {
                console.log('item.id: ');
            }

        } catch (e) {
            console.log('Error: ' + e.message);
            Alert.alert(e.message);
        }
    };
      //==================================================================================================
    handleUpdateValue = async data => {
            if (!data.value) {
                console.error("Characteristic value is undefined");
                return null;
            }
    
            console.log('data came in: ', data);
            const value = this.byteArrayToHexString(data.value);
            console.log('hexString of data:' , value);
            console.log('currentCommand:',this.currentCommand);
    
            switch (this.currentCommand) {
                case BgmCommand.WAIT_NOTIFY:
                    const meterSN = this.hexStringToAscii(value.slice(1, value.length -1).toString('utf-8'));
                    console.log('meterSN:', meterSN);
                    this.meterSN=meterSN;
                    this.currentCommand = BgmCommand.OPEN_PCL;
                  break;

                case BgmCommand.OPEN_PCL:
                    await this.BluetoothManager.stopNotification() // or await this.BluetoothManager.stopNotification()
                        .then(() => {
                            // setIsMonitoring(true);
                            // alert('aaa');
                        })
                        .catch(err => {
                            // setIsMonitoring(false);
                            // alert('bbb');
                        });
                    let checkPCL=await this.checkIfPCL_Is_Open();
                    if(checkPCL==true)
                    {
                        console.log('PCL Opened.');
                        let cmd_ModelName=[0xB0, 0x00, 0xB0];
                        await this.BluetoothManager.write_writeChara(cmd_ModelName)
                        .then(() => {
                            this.currentCommand = BgmCommand.GET_MODEL_NAME;
                            });
                    }
                break;
    
                case BgmCommand.GET_MODEL_NAME:
                    const modelName = this.hexStringToAscii(value.slice(4, value.length-1).toString('utf-8'));
                    this.modelName=modelName;
                    console.log('modelName:', modelName);
                    let cmd_firmware_version=[0xB0, 0x01, 0xB1];
                    await this.BluetoothManager.write_writeChara(cmd_firmware_version)
                    .then(() => {
                        this.currentCommand = BgmCommand.GET_FIRMWARE_VERSION;
                        });
                  break;
    
                case BgmCommand.GET_FIRMWARE_VERSION:
                  const firmwareVersion = this.hexStringToAscii(value.slice(4, value.length-1).toString('utf-8'));
                  this.firmwareVersion=firmwareVersion;
                  console.log('firmwareVersion:', firmwareVersion);
                  let cmd_total_record_count=[0xB0, 0x33, 0xE3];
                    await this.BluetoothManager.write_writeChara(cmd_total_record_count)
                    .then(() => {
                        this.currentCommand =  BgmCommand.GET_TOTAL_RECORD_COUNT;
                        });
                break;
    
                case BgmCommand.GET_TOTAL_RECORD_COUNT:
                  let bytes = value.slice(4, value.length - 1);
                  let counts = this.getTotalCount(bytes.slice(4,6));
                  this.totalCount=counts;
                  console.log('totalCount:', counts);
    
                    if (counts > 0) {
                        let cmd_get_one_record=this.getOneRecordCmd();
                        await this.BluetoothManager.write_writeChara(cmd_get_one_record)
                        .then(() => {
                            this.currentCommand = BgmCommand.GET_GLUCOSE_RECORD;
                        });
                    } else {
                        console.log('disconnecting')
                        this.disconnect(data.peripheral);
                    }
                  break;
    
                case BgmCommand.GET_GLUCOSE_RECORD:
                    try{
                        const tempBytes = value.slice(2, value.length-1);
                        this.glucoseData = this.glucoseData.concat(tempBytes);
          
                        if (value[0] !== value[1]) {
                              console.log('returning xxx');
                              return;
                        }
          
                        // Process the glucose data
                        this.parserOneRecord(this.glucoseData.slice(2, this.glucoseData.length-1))
          
                        this.glucoseData = [];
                        this.totalCount -= 1;
          
                        if (this.totalCount === 0) {
                          let cmd_stop_broadcast=[0xB0, 0x36, 0x78, 0x5E];
                                  await this.BluetoothManager.write_writeChara(cmd_stop_broadcast)
                                  .then(() => {
                                      this.currentCommand = BgmCommand.STOP_BROADCAST;
                                      });
                        } else {
                          let cmd_get_one_record=this.getOneRecordCmd();
                          await this.BluetoothManager.write_writeChara(cmd_get_one_record);
                        }
                    }
                    catch(err){
                        console.log('err:',err);
                    }
                  break;
    
                default:
                    console.log('disconnecting');
                    this.disconnect(data.peripheral);
                  break;
              }
    }

    async checkIfPCL_Is_Open(){
        let cmd_open_pcl= [0x00];
        this.BluetoothManager.write_pclChara(cmd_open_pcl);
        let result=await this.BluetoothManager.read_pclChara();
        const firstValue = result ? result[0] : 0x01;
        if (firstValue === 0x00){
            return true;
        }
        else
        {
            console.log(`retry PCL Opening for ${this.open_pcl_try_counter} time`);
            this.open_pcl_try_counter=this.open_pcl_try_counter+1;
            if(this.open_pcl_try_counter<=10)
                return await checkIfPCL_Is_Open();
            else{
                console.log('cannot open pcl');
                return false;
            }
        }
    }

    byteArrayToHexString(byteArray) {
        return byteArray.map(byte => {
          // Convert each byte to a hexadecimal string and pad with 0 if necessary
          return '0x' + ('0' + (byte & 0xFF).toString(16)).slice(-2).toUpperCase();
        }).join(' ');
    }

    hexStringToAscii(hexString) {
        // Remove any "0x" prefixes and split the string into an array of hex values
        const hexValues = hexString.replace(/0x/g, '').split(' ');
      
        // Convert hex values to ASCII characters
        let asciiString = '';
        hexValues.forEach(hex => {
          const byte = parseInt(hex, 16); // Convert hex to a byte (integer)
          
          // Only include printable ASCII characters (range 32 to 126)
          if (byte >= 32 && byte <= 126) {
            asciiString += String.fromCharCode(byte);
          }
        });
      
        return asciiString;
    }

    hexToDecimal(hexString) {
        return parseInt(hexString, 16);
    }

    getOneRecordCmd() {
        // Create the byte array (in JavaScript, this is just a regular array)
        const cmd = [0xB0, 0x61, 0x00, 0x00, 0x00];

        // Assume totalCount is defined elsewhere
        cmd[2] = this.totalCount & 0xFF;          // Equivalent of totalCount.toUByte().and(0xFF.toUByte())
        cmd[3] = (this.totalCount >> 8) & 0xFF;   // Equivalent of totalCount.toUInt().shr(8)

        // Calculate checksum and store it in cmd[4]
        cmd[4] = (cmd[0] + cmd[1] + cmd[2] + cmd[3]) & 0xFF; // Calculate checksum

        // Return the array (which can be used for BLE commands)
        return cmd;
      }

      getTotalCount(bytes) {
        let total = 0;

        // Iterate through the bytes array
        for (let i = 0; i < bytes.length; i++) {
          total += (bytes[i] & 0xFF) << (8 * i);
        }

        return total;
      }

    parserOneRecord = (data) => {
        console.log(`parsing data: ${data}`);
        const record = data.slice(2, 16);
        const dataByte = record.slice(0, 6);

        const marker = this.syncMarker(dataByte);
        const timeZone = this.syncTimeZone(dataByte);
        const isHi = this.syncHiFlag(dataByte);
        const isCS = this.syncCS(dataByte);
        const isKetone = this.syncKetoneFlag(dataByte);

        let targetMeasurementKey;
        let targetMeasurementValue;

        if (isKetone) {
          targetMeasurementKey = "Ketone";
          targetMeasurementValue = this.syncKetone(dataByte);
        } else {
          targetMeasurementKey = "Glucose";
          targetMeasurementValue = this.syncGlucose(dataByte);
        }

        let measureDateTime;
        try {
          measureDateTime = this.syncDateTime(dataByte);
        } catch (e) {
          measureDateTime = "INVALID";
        }

        console.log(`
            Sequence => ${this.totalCount}
            Marker ==> ${marker}
            ${targetMeasurementKey} ==> ${targetMeasurementValue}
            isHi ==> ${isHi}
            isCS ==> ${isCS}
            TimeZone ==> ${timeZone}
            Measure DateTime ==> ${measureDateTime}
          `);
      };

      syncMarker = (dataByte) => {
        return (dataByte[4] & 0xFF & 0x38) >> 3;
      };

      syncTimeZone = (dataByte) => {
        return ((dataByte[4] & 0xFF & 0xC0) >> 3) +
               ((dataByte[2] & 0xFF & 0xC0) >> 5) +
               ((dataByte[1] & 0xFF & 0x20) >> 5);
      };

      syncGlucose = (dataByte) => {
        return ((dataByte[4] & 0xFF & 0x03) << 8) + (dataByte[5] & 0xFF);
      };

      syncKetone = (dataByte) => {
        return Math.round((((dataByte[4] & 0xFF & 0x03) << 8) + (dataByte[5] & 0xFF)) / 10.0 * 10.4);
      };

      syncKetoneFlag = (dataByte) => {
        return (dataByte[0] & 0xFF & 0x20) >> 5 === 1;
      };

      syncHiFlag = (dataByte) => {
        return (dataByte[3] & 0xFF & 0x80) >> 7 === 1;
      };

      syncCS = (dataByte) => {
        return (dataByte[4] & 0xFF & 0x04) >> 2 === 1;
      };

      syncDateTime = (dataByte) => {
        const year = (dataByte[3] & 0xFF & 0x7F);
        const month = ((dataByte[1] & 0xFF & 0xC0) >> 4) + ((dataByte[0] & 0xFF & 0xC0) >> 6) + 1;
        const day = (dataByte[0] & 0xFF & 0x1F) + 1;
        const hour = (dataByte[1] & 0xFF & 0x1F);
        const minute = (dataByte[2] & 0xFF & 0x3F);

        return `${year}-${month}-${day} ${hour}:${minute}`;
      };
    //==================================================================================================
    disconnect = async item => {
        try {
            if (item.id) {
                this.BluetoothManager.disconnect();
                item.connected = 'false';
            }
            else {
                const disonnected = await item.disconnect();
                if (disonnected) {
                    item.connected = 'false';
                }
            }
        } catch (e) {
            console.log('Error: ' + e.message);
        }
    };
    //==================================================================================================
    async itemClick(item) {
        await this.connect(item);
        console.log(item.id);
    }


    //==================================================================================================
    async requestAccessFineLocationPermission() {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    //==================================================================================================
    async requestAccessBluetooth() {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    //==================================================================================================
    //show dialog
    async ShowCustomAlert() {
        if (this.state.connected) {// if is conected the disconect it
            this.BluetoothManager.disconnect();
            this.setState({
                connected: false
            });
            return;
        }
        //stop scan the start it
        this.BluetoothManager.stopScan();
        this.BluetoothManager.start();

        this.setState({ devices: [], pairedDevices: [] });
        await this.discoverUnpairedDevices();
        await this.getBleConnected();

        this.setState({
            showDialog: true
        });
    }
    //======================================================================================================================
    //stop scaning
    async CloseCustomAlert() {

        this.BluetoothManager.stopScan();
        this.setState({
            showDialog: false
        });
    }
     //======================================================================================================================
    //stop scaning
    async CloseSettingsDialog() {
        this.setState({
            showSettingsDialog: false
        });
    }
    //======================================================================================================================
    async SendCommandToModule(cmd)
    {
        console.log('SendCommandToModule called');
        var bleDevices = [];
        try {
            bleDevices = await this.BluetoothManager.getConnectedPeripherals();
        }
        catch (ex) { 
            console.log('SendCommandToModule err:', err);
        }
        if (bleDevices == undefined || bleDevices.length == 0) {
            Alert.alert("Device is not connected");
            return;
        }
        await this.BluetoothManager.writeWithoutResponseBytes(cmd);
    }

    async SendCommandToModule2(cmd)
    {
        console.log('SendCommandToModule2 called');
        var bleDevices = [];
        try {
            bleDevices = await this.BluetoothManager.getConnectedPeripherals();
        }
        catch (ex) { 
            console.log('SendCommandToModule2 err:', err);
        }
        if (bleDevices == undefined || bleDevices.length == 0) {
            Alert.alert("Device is not connected");
            return;
        }
        await this.BluetoothManager.write(cmd);
    }
    //======================================================================================================================
   // get device info (firmware and hardware version)
    async GetDeviceInfo() {

        var bleDevices = [];
        try {
            bleDevices = await this.BluetoothManager.getConnectedPeripherals();
        }
        catch (ex) { }
        if (bleDevices == undefined || bleDevices.length == 0) {
            Alert.alert("Device is not connected");
            return;
        }
        console.log("write")
        setTimeout(() => {
            let CMD_FW_VERSION = new Array(0x55, 0xaa, 0x04, 0xfc, 0x00, 0xff);
            this.BluetoothManager.writeWithoutResponseBytes(CMD_FW_VERSION);
        }, 500);


        let CMD_HW_VERSION = new Array(0x55, 0xaa, 0x04, 0xfd, 0x00, 0xfe);
        this.BluetoothManager.writeWithoutResponseBytes(CMD_HW_VERSION);
    }
    //======================================================================================================================
    ChangePage(page)
    {
        this.setState({pageName:page})
    }
//======================================================================================================================
    render() {
        return (
        <GluestackUIProvider config={config}>
            <StatusBar backgroundColor={'#6574CF'} />
            <ScrollView>
                <Box
                    bgColor="#6574CF"
                    justifyContent="space-between"
                    flexDirection="row">
                    <TouchableOpacity
                        onPress={this.goBack}
                        style={{ marginTop: 20, marginLeft: 15 }}>
                        <Icon as={ArrowLeftIcon} width={50} height={40} color='#fff' />
                    </TouchableOpacity>
                    <Heading color="#fff" p={10}>
                    Take a measurment
                    </Heading>
                    <BurgerMenu />
                    </Box>
                <View style={styles.container}>
                    <HStack
                        borderWidth={1}
                        mt={10}
                        w={'95%'}
                        alignSelf="center"
                        borderColor="#BEBFC0"
                    />
                    <Box alignSelf='center' alignItems="center" mt="$6">
                        <Button
                        width={200}
                        height={60}
                        mb={10}
                        backgroundColor="#0082FC"
                        onPress={() => { this.ShowCustomAlert() }}
                        >
                        <ButtonIcon as={IconBluetoothW} />
                        <ButtonText>{this.state.connected ? " Disconnect" : " Scan"}</ButtonText>
                        </Button>
                        {this.state.connected && this.state.device != undefined && (
                            <Text style={styles.description}>Connected to: {this.state.device.name}</Text>
                        )}
                    </Box>
                    <TouchableHighlight
                        style={styles.settingButton}
                        onPress={() => this.setState({ showSettingsDialog: !this.state.showSettingsDialog })}>
                        <Image
                            style={{ width: 30, height: 30}}
                            source={require('./PM6100/assets/ic_settings.png')}
                        />
                    </TouchableHighlight>
                    
                    {this.state.showSettingsDialog && <SettingsPage parent={this} nibpModeIndex={nibpModeIndex} ecgGainIndex={ecgGainIndex}
                                respGainIndex={respGainIndex} ecgFilterIndex={ecgFilterIndex}
                                ecgLeadModeIndex={ecgLeadModeIndex}/>}

                    {(
                        <View>
                           <View >
                           <ChartInfoLine chartName="Glucose" />
                           <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', }}>
                           <Text style={styles.chartName}>meterSN:{this.meterSN} | </Text>
                           <Text style={styles.chartName}>modelName:{this.modelName} | </Text>
                           <Text style={styles.chartName}>firmwareVersion:{this.firmwareVersion} | </Text>
                           <Text style={styles.chartName}>totalCount:{this.totalCount}</Text>
                                </View>
                                <View style={styles.CaptureButton}>
                                <TouchableOpacity style={styles.buttonContainer}
                            onPress={() => { this.captureGlucose(); }}>
                            <Text style={styles.buttonText}>Capture</Text>
                        </TouchableOpacity>
                            </View>
                            </View>
                        </View>
                    )
                    }

                    {this.state.showDialog && <DialogList parent={this} devices={this.state.devices}
                        scanning={this.state.scanning} />}



                </View>
            </ScrollView>
            </GluestackUIProvider>
        )
    }
}

const styles = StyleSheet.create({
    CaptureButton:{
        alignItems:'center',
        justifyContent:'center'
    },
    parameterValue: {
        marginTop: 1,
        marginRight:15,
        textAlign: 'center',
        color: "#859dfa",
        fontSize: 17,
        marginBottom: 1,
    },
    settingButton: {
        width: 45,
        height: 45,
        alignSelf: 'flex-end',
        borderStyle: 'solid',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 32,
        height: 32,
    },
    container: {
        flex: 1,
        backgroundColor: "#e9e9f4",
        alignItems: 'center',
        paddingTop: 10,
    },
    title: {
        textAlign: 'center',
        color: "#7ee0d0",
        fontSize: 23,
        marginBottom: 5,
    },
    chartName: {
        marginTop: 1,
        textAlign: 'left',
        color: "#859dfa",
        fontSize: 20,
        marginRight: 5,
        marginBottom: 1,
    },
    description: {
        marginTop: 10,
        marginEnd: 10,
        textAlign: 'center',
        color: "#0e1369",
        fontSize: 16,
        marginBottom: 5,
        backgroundColor:"#a2b4fb",
        padding:15,
        borderRadius: 5,
    },
    buttonContainer: {
        width: 200,
        height: 60,
        borderRadius: 5,
        backgroundColor: "#1EC760",
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        marginBottom: 15,
        marginTop: 15
    },
    buttonContainerNib: {
        width: 200,
        height: 60,
        borderRadius: 5,
        backgroundColor: "#3a38ae",
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        marginBottom: 15,
        marginTop: 15
    },
    buttonTab: {
        width: 165,
        height: 130,
        borderRadius: 4,
        backgroundColor: "#008080",
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        margin:8,
        flexDirection:'column',
        elevation:5,
        shadowColor: "#000",
        shadowOpacity: 2,
        shadowRadius:3,
        shadowOffset:{width:0, height:2},
    },
    buttonTabSelected: {
        width: 165,
        height: 130,
        borderRadius: 4,
        backgroundColor: "#045038",
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        margin:8,
        flexDirection:'column',
        elevation:5,
        shadowColor: "#000",
        shadowOpacity: 1,
        shadowRadius:3,
        shadowOffset:{width:0, height:2},
    },
    buttonContainer2: {
        width: 160,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#9baffb",
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        marginBottom: 15,
        marginTop: 15
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 18,
    },
    txtTab: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight:'600',
    },
    iconB:{
        width: 60,
        height: 60,
        margin:4,
        backgroundColor:'#fcfefb',
        borderRadius: 4,
        elevation:6,
        shadowColor: "#000",
        shadowOpacity: 1,
        shadowRadius:3,
    }
});
export default MainPage;

