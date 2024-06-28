import { Socket } from "./client.js"
import { SerialReqManager, SerialUtil } from "./serial.js"

export class Modbus extends SerialReqManager {
    constructor(baudrate, tag, port, parity, policy = "Queue") {
        super(baudrate, tag, port, parity, policy)
        this.Busy = false

        this.NodeAddress = null
        this.CreateResult = null
        this.NodeAddressResult = null
        this.OpenSlaveResult = null
        this.CloseSlaveResult = null
        this.FreeSlaveResult = null

        this.ReadInputRegistersResult = null
        this.ReadHoldingRegistersResult = null
        this.ReadDeviceIdentificationResult = null
        this.WriteSingleRegisterResult = null
        this.WriteMultipleRegistersResult = null
        this.startSocketCallbacksMDB()
    }

    static RESPONSE_TIMEOUT = 300

    startSocketCallbacksMDB() {
        Socket.IO.on(Socket.Events.FREE_SLAVE_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.FreeSlaveResult = res } } })
        Socket.IO.on(Socket.Events.OPEN_MODBUS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.OpenSlaveResult = res } } })
        Socket.IO.on(Socket.Events.CLOSE_MODBUS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.CloseSlaveResult = res } } })
        Socket.IO.on(Socket.Events.CREATE_MODBUS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.CreateResult = res } } })
        Socket.IO.on(Socket.Events.READ_DEVICE_ID_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadDeviceIdentificationResult = res } } })
        Socket.IO.on(Socket.Events.SET_NODE_ADDRESS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.NodeAddressResult = res; this.NodeAddress = res.addr } } })
        Socket.IO.on(Socket.Events.READ_INPUT_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadInputRegistersResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTER_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteSingleRegisterResult = res } } })
        Socket.IO.on(Socket.Events.READ_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadHoldingRegistersResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteMultipleRegistersResult = res } } })
    }

    /**
     * Transform a instance of serial into a Modbus device (server-side).
     * 
     * ⚠️ After transforming, the serial instance will not be available for use.
     * 
     * ⚠️ After creating the slave, the port will remain open, so it's necessary to open it manually.
     *
     * @returns {Promise<{success: boolean, msg: string}>}
     * 
     * @example
     * const mdb = new Modbus()
     * await mdb.create()
     *
     */
    async create() {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.CreateResult = { success: false, msg: `${this.TAG}: Falha ao criar slave (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.CREATE_MODBUS_REQ, { portInfo: this.PORT, config: { baudRate: this.BAUDRATE, parity: this.PARITY, tagName: this.TAG } })

            while (this.CreateResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.CreateResult.success
                ? Log.console(`MDB ${this.PORT == null ? "?" : this.PORT.path}: ${this.CreateResult.msg}`, this.Log.success)
                : Log.warn(`MDB ${this.PORT == null ? "?" : this.PORT.path}: ${this.CreateResult.msg}`, this.Log.error)

            resolve(this.CreateResult)

            this.CreateResult = null
            this.Busy = false
        })
    }

    /**
     * Opens serial port of Modbus device.
     *
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     * 
     * @example
     * const modbus = new Modbus()
     * await modbus.create()
     * await modbus.closeSlave()
     * await modbus.openSlave()
     */
    async openSlave() {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.OpenSlaveResult = { success: false, msg: `${this.TAG}: Falha ao abrir slave (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.OPEN_MODBUS_REQ, { tagName: this.TAG })

            while (this.OpenSlaveResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.OpenSlaveResult.success
                ? Log.console(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.OpenSlaveResult.msg}`, this.Log.success)
                : Log.warn(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.OpenSlaveResult.msg}`, this.Log.error)

            resolve(this.OpenSlaveResult)

            this.OpenSlaveResult = null
            this.Busy = false
        })
    }

    /**
     * Fecha porta serial do dispositivo Modbus.
     *
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     * 
     * @example
     * const modbus = new Modbus()
     * await modbus.create()
     * await modbus.closeSlave()
     */
    async closeSlave() {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.CloseSlaveResult = { success: false, msg: `${this.TAG}: Falha ao fechar slave (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.CLOSE_MODBUS_REQ, { tagName: this.TAG })

            while (this.CloseSlaveResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.CloseSlaveResult.success
                ? Log.console(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.CloseSlaveResult.msg}`, this.Log.success)
                : Log.warn(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.CloseSlaveResult.msg}`, this.Log.error)

            resolve(this.CloseSlaveResult)

            this.CloseSlaveResult = null
            this.Busy = false
        })
    }

    /**
     * Libera o slave, permitindo transforma-lo novamente em uma instancia serial comum.
     * 
     * ⚠️ Após liberar o slave, nao sera possivel continuar comunicando
     *
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     * 
     * @example
     * const mdb = new Modbus()
     * await mdb.create()
     * const result = await mdb.freeSlave()
     */
    async freeSlave() {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.FreeSlaveResult = { success: false, msg: `${this.TAG}: Falha ao libertar slave (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.CLOSE_MODBUS_REQ, { tagName: this.TAG })

            while (this.FreeSlaveResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.FreeSlaveResult.success
                ? Log.console(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.FreeSlaveResult.msg}`, this.Log.success)
                : Log.warn(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.FreeSlaveResult.msg}`, this.Log.error)

            resolve(this.FreeSlaveResult)

            this.FreeSlaveResult = null
            this.Busy = false
        })
    }

    /**
     * Define o node address para o dispositivo Modbus.
     *
     * @param {number} nodeAddress - O novo node address a ser definido.
     * @return {Promise<{success: boolean, msg: string}>} Uma promessa que resolve para um objeto com o status de sucesso e uma mensagem.
     * 
     * @example
     * const mdb = new Modbus()
     * await mdb.create()
     * const result = await mdb.setNodeAddress(1)
     */
    async setNodeAddress(nodeAddress) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.NodeAddressResult = { success: false, msg: `${this.TAG}: Falha ao atribuir endereço (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.SET_NODE_ADDRESS_REQ, { nodeAddress, tagName: this.TAG })

            while (this.NodeAddressResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.NodeAddressResult.success
                ? Log.console(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.NodeAddressResult.msg}`, this.Log.success)
                : Log.warn(`MDB ADDR ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: ${this.NodeAddressResult.msg}`, this.Log.error)

            resolve(this.NodeAddressResult)

            this.NodeAddressResult = null
            this.Busy = false
        })
    }


    /**
     * Asynchronously reads the device identification.
     *
     * @param {number} idCode - The identification code.
     * @param {number} objectId - The object ID.
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     */
    async ReadDeviceIdentification(idCode, objectId) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadDeviceIdentificationResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_DEVICE_ID_REQ, { idCode, objectId, tagName: this.TAG })
            Log.console(`MDB F43 ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: idCode => ${idCode} objectId => ${objectId}`, this.Log.req)

            while (this.ReadDeviceIdentificationResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.ReadDeviceIdentificationResult.success
                ? console.log(this.ReadDeviceIdentificationResult.msg)
                : console.error(this.ReadDeviceIdentificationResult.msg)

            resolve(this.ReadDeviceIdentificationResult)

            this.ReadDeviceIdentificationResult = null
            this.Busy = false
        })
    }


    /**
     * Asynchronously reads input registers from the Modbus device.
     *
     * @param {number} startAddress - The starting address of the input registers.
     * @param {number} qty - The quantity of input registers to read.
     * @param {number} [tryNumber=1] - The current try number
     * @param {number} [maxTries=3] - The maximum number of tries 
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     * 
     * @example
     * const modbus = new Modbus();
     * const result = await modbus.ReadInputRegisters(0, 10);
     */
    async ReadInputRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadInputRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_INPUT_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F04 ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

            while (this.ReadInputRegistersResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.ReadInputRegistersResult.success
                ? console.log(this.ReadInputRegistersResult.msg)
                : console.error(this.ReadInputRegistersResult.msg)

            if (this.ReadInputRegistersResult.success) { resolve(this.ReadInputRegistersResult) }

            else if (tryNumber < maxTries) {
                tryNumber++
                resolve(this.ReadInputRegisters(startAddress, qty, tryNumber, maxTries))

            } else { resolve(this.ReadInputRegistersResult) }

            this.ReadInputRegistersResult = null
            this.Busy = false
        })
    }


    /**
     * Reads holding registers from a Modbus device.
     *
     * @param {number} startAddress - The starting address of the holding registers.
     * @param {number} qty - The quantity of holding registers to read.
     * @param {number} [tryNumber=1] - The number of times to try reading the holding registers.
     * @param {number} [maxTries=3] - The maximum number of tries to read the holding registers.
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves with the result of the read operation.
     * @example
     * const modbus = new Modbus();
     * const { success, msg } = await modbus.ReadHoldingRegisters(0, 10);
     */
    async ReadHoldingRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadHoldingRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_HOLDING_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F03 ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

            while (this.ReadHoldingRegistersResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.ReadHoldingRegistersResult.success
                ? console.log(this.ReadHoldingRegistersResult.msg)
                : console.error(this.ReadHoldingRegistersResult.msg)

            if (this.ReadHoldingRegistersResult.success) { resolve(this.ReadHoldingRegistersResult) }

            else if (tryNumber < maxTries) {
                tryNumber++
                resolve(this.ReadHoldingRegisters(startAddress, qty, tryNumber, maxTries))

            } else { resolve(this.ReadHoldingRegistersResult) }

            this.ReadHoldingRegistersResult = null
            this.Busy = false
        })
    }


    /**
     * Writes a single register on a Modbus device.
     *
     * @param {number} startAddress - The starting address of the register.
     * @param {number} value - The value to write to the register.
     * @param {number} [tryNumber=1] - The number of tries made so far.
     * @param {number} [maxTries=3] - The maximum number of tries allowed.
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to an object with the success status and a message.
     * 
     * @example
     * const mdb = new Modbus(9600, "MDB")
     * const { success, msg } = await mdb.WriteSingleRegister(0x00, 0x01)
     */
    async WriteSingleRegister(startAddress, value, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.WriteSingleRegisterResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTER_REQ, { startAddress, value, tagName: this.TAG })
            Log.console(`MDB F06 ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) value => ${value}`, this.Log.req)

            while (this.WriteSingleRegisterResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.WriteSingleRegisterResult.success
                ? console.log(this.WriteSingleRegisterResult.msg)
                : console.error(this.WriteSingleRegisterResult.msg)

            if (this.WriteSingleRegisterResult.success) { resolve(this.WriteSingleRegisterResult) }

            else if (tryNumber < maxTries) {
                tryNumber++
                resolve(this.WriteSingleRegister(startAddress, value, tryNumber, maxTries))

            } else { resolve(this.WriteSingleRegisterResult) }

            this.WriteSingleRegisterResult = null
            this.Busy = false
        })
    }


    /**
     * Asynchronously writes multiple registers.
     *
     * @param {number} startAddress - The starting address for writing registers.
     * @param {Array} arrValues - An array of values to write.
     * @param {number} tryNumber - The number of attempts
     * @param {number} maxTries - The maximum number of tries
     * @return {Promise<{success: boolean, msg: string}>} A promise that resolves to the result of writing multiple registers.
     * 
     * @example
     * const mdb = new Modbus(9600, "MDB")
     * const { success, msg } = await mdb.WriteMultipleRegisters(0x00, [0x01, 0x02])
     */
    async WriteMultipleRegisters(startAddress, arrValues, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.WriteMultipleRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTERS_REQ, { startAddress, arrValues, tagName: this.TAG })
            Log.console(`MDB F16 ${this.PORT == null ? "?" : this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) arrValues => [${arrValues}]`, this.Log.req)

            while (this.WriteMultipleRegistersResult == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            this.WriteMultipleRegistersResult.success
                ? console.log(this.WriteMultipleRegistersResult.msg)
                : console.error(this.WriteMultipleRegistersResult.msg)

            if (this.WriteMultipleRegistersResult.success) { resolve(this.WriteMultipleRegistersResult) }

            else if (tryNumber < maxTries) {
                tryNumber++
                resolve(this.WriteMultipleRegisters(startAddress, arrValues, tryNumber, maxTries))

            } else { resolve(this.WriteMultipleRegistersResult) }

            this.Busy = false
            this.WriteMultipleRegistersResult = null
        })
    }
}