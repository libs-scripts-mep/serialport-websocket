import { Socket } from "./client.js"
import { SerialReqManager, SerialUtil } from "./serial.js"

export class Modbus extends SerialReqManager {
    constructor(baudrate, tag, port, parity, policy = "Queue") {
        super(baudrate, tag, port, parity, policy)

        this.NodeAddress = null

        this.CreateResult = null
        this.NodeAddressResult = null

        this.ReadInputRegistersResult = null
        this.ReadHoldingRegistersResult = null
        this.ReadDeviceIdentificationResult = null
        this.WriteSingleRegisterResult = null
        this.WriteMultipleRegistersResult = null
        this.startSocketCallbacksMDB()
    }

    startSocketCallbacksMDB() {
        Socket.IO.on(Socket.Events.CREATE_MODBUS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.CreateResult = res } } })
        Socket.IO.on(Socket.Events.SET_NODE_ADDRESS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.NodeAddressResult = res; this.NodeAddress = res.addr } } })
        Socket.IO.on(Socket.Events.READ_DEVICE_ID_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadDeviceIdentificationResult = res } } })
        Socket.IO.on(Socket.Events.READ_INPUT_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadInputRegistersResult = res } } })
        Socket.IO.on(Socket.Events.READ_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadHoldingRegistersResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTER_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteSingleRegisterResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteMultipleRegistersResult = res } } })
    }

    async create() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.CREATE_MODBUS_REQ, { portInfo: this.PORT, config: { baudRate: this.BAUDRATE, tagName: this.TAG } })

            while (this.CreateResult == null) { await SerialUtil.Delay(10) }
            Log.console(`MDB ${this.PORT.path}: ${this.CreateResult.msg}`, this.CreateResult.success ? this.Log.success : this.Log.error)

            resolve(this.CreateResult)
            this.CreateResult = null
        })
    }

    async setNodeAddress(nodeAddress) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.SET_NODE_ADDRESS_REQ, { nodeAddress, tagName: this.TAG })

            while (this.NodeAddressResult == null) { await SerialUtil.Delay(10) }
            Log.console(`MDB ADDR ${this.PORT.path}: ${this.NodeAddressResult.msg}`, this.NodeAddressResult.success ? this.Log.success : this.Log.error)

            resolve(this.NodeAddressResult)
        })
    }

    async ReadDeviceIdentification(idCode, objectId) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.READ_DEVICE_ID_REQ, { idCode, objectId, tagName: this.TAG })
            Log.console(`MDB F43 ${this.PORT.path}: idCode => ${idCode} objectId => ${objectId}`, this.Log.req)

            while (this.ReadDeviceIdentificationResult == null) { await SerialUtil.Delay(10) }

            this.ReadDeviceIdentificationResult.success ? console.log(this.ReadDeviceIdentificationResult.msg) : Log.console(this.ReadDeviceIdentificationResult.msg, this.Log.error)

            resolve(this.ReadDeviceIdentificationResult)
            this.ReadDeviceIdentificationResult = null
        })
    }

    async ReadInputRegisters(startAddress, qty) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.READ_INPUT_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F04 ${this.PORT.path}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

            while (this.ReadInputRegistersResult == null) { await SerialUtil.Delay(10) }

            this.ReadInputRegistersResult.success ? console.log(this.ReadInputRegistersResult.msg) : Log.console(this.ReadInputRegistersResult.msg, this.Log.error)

            resolve(this.ReadInputRegistersResult)
            this.ReadInputRegistersResult = null
        })
    }

    async ReadHoldingRegisters(startAddress, qty) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.READ_HOLDING_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F03 ${this.PORT.path}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

            while (this.ReadInputRegistersResult == null) { await SerialUtil.Delay(10) }

            this.ReadInputRegistersResult.success ? console.log(this.ReadInputRegistersResult.msg) : Log.console(this.ReadInputRegistersResult.msg, this.Log.error)

            resolve(this.ReadInputRegistersResult)
            this.ReadInputRegistersResult = null
        })
    }

    async WriteSingleRegister(startAddress, value) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTER_REQ, { startAddress, value, tagName: this.TAG })
            Log.console(`MDB F06 ${this.PORT.path}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) value => ${value}`, this.Log.req)

            while (this.WriteSingleRegisterResult == null) { await SerialUtil.Delay(10) }

            this.WriteSingleRegisterResult.success ? console.log(this.WriteSingleRegisterResult.msg) : Log.console(this.WriteSingleRegisterResult.msg, this.Log.error)

            resolve(this.WriteSingleRegisterResult)
            this.WriteSingleRegisterResult = null
        })
    }

    async WriteMultipleRegisters(startAddress, arrValues) {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTERS_REQ, { startAddress, arrValues, tagName: this.TAG })
            Log.console(`MDB F16 ${this.PORT.path}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) arrValues => ${arrValues}`, this.Log.req)

            while (this.WriteMultipleRegistersResult == null) { await SerialUtil.Delay(10) }

            this.WriteMultipleRegistersResult.success ? console.log(this.WriteMultipleRegistersResult.msg) : Log.console(this.WriteMultipleRegistersResult.msg, this.Log.error)

            resolve(this.WriteMultipleRegistersResult)
            this.WriteMultipleRegistersResult = null
        })
    }
}