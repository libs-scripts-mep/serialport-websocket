import { Socket } from "./client.js"
import { SerialReqManager, SerialUtil } from "./serial.js"

export class Modbus extends SerialReqManager {
    constructor(baudrate, tag, port, parity, policy = "Queue") {
        super(baudrate, tag, port, parity, policy)
        this.Busy = false

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

    static RESPONSE_TIMEOUT = 300

    startSocketCallbacksMDB() {
        Socket.IO.on(Socket.Events.CREATE_MODBUS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.CreateResult = res } } })
        Socket.IO.on(Socket.Events.SET_NODE_ADDRESS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.NodeAddressResult = res; this.NodeAddress = res.addr } } })
        Socket.IO.on(Socket.Events.READ_DEVICE_ID_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadDeviceIdentificationResult = res } } })
        Socket.IO.on(Socket.Events.READ_INPUT_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadInputRegistersResult = res } } })
        Socket.IO.on(Socket.Events.READ_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.ReadHoldingRegistersResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTER_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteSingleRegisterResult = res } } })
        Socket.IO.on(Socket.Events.WRTIE_HOLDING_REGISTERS_RES, (res) => { if (this.PORT != null) { if (res.path == this.PORT.path) { this.WriteMultipleRegistersResult = res } } })
    }

    /**
     * Transforma uma porta serial em um dispositivo modbus (server-side)
     * @returns Object 
     * 
     * # Exemplos
     * 
     * ```js
     * const result = await this.create()
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
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
                ? Log.console(`MDB ${this.PORT.path}: ${this.CreateResult.msg}`, this.Log.success)
                : Log.warn(`MDB ${this.PORT.path}: ${this.CreateResult.msg}`, this.Log.error)

            resolve(this.CreateResult)

            this.CreateResult = null
            this.Busy = false
        })
    }

    /**
     * 
     * @param {Number} nodeAddress 
     * @returns Object 
     * 
     * # Exemplos
     * 
     * ```js
     * const result = await this.setNodeAddress(0x10)
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
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
                ? Log.console(`MDB ADDR ${this.PORT.path} ${this.TAG}: ${this.NodeAddressResult.msg}`, this.Log.success)
                : Log.warn(`MDB ADDR ${this.PORT.path} ${this.TAG}: ${this.NodeAddressResult.msg}`, this.Log.error)

            resolve(this.NodeAddressResult)

            this.NodeAddressResult = null
            this.Busy = false
        })
    }

    /**
     * 
     * @param {Number} idCode 
     * @param {Number} objectId 
     * 
     * @returns Object 
     */
    async ReadDeviceIdentification(idCode, objectId) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadDeviceIdentificationResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_DEVICE_ID_REQ, { idCode, objectId, tagName: this.TAG })
            Log.console(`MDB F43 ${this.PORT.path} ${this.TAG}: idCode => ${idCode} objectId => ${objectId}`, this.Log.req)

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
     * Realiza leitura de registradores somente leitura
     * @param {Number} startAddress Endereço inicial de leitura
     * @param {Number} qty Quantidade de registradores a serem lidos
     * @param {Number} tryNumber Número de tentativas para realizar a leitura
     * @param {Number} maxTries Contador de tentativas
     * @returns Object 
     * 
     * Utilizando configurações de tentativas default
     * ```js
     * const writeValue = await this.ReadInputRegisters(0x20, 30)
     * ```
     * Utilizando configurações de tentativas personalizadas
     * ```js
     * const writeValue = await this.ReadInputRegisters(0x20, 30, 1, 1)
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
     */
    async ReadInputRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadInputRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_INPUT_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F04 ${this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

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
     * Realiza leitura de registradores de leitura e escrita
     * @param {Number} startAddress Endereço inicial de leitura
     * @param {Number} qty Quantidade de registradores a serem lidos
     * @param {Number} tryNumber Número de tentativas para realizar a leitura
     * @param {Number} maxTries Contador de tentativas
     * @returns Object 
     * # Exemplos
     * 
     * Utilizando configurações de tentativas default
     * ```js
     * const writeValue = await this.ReadHoldingRegisters(0x30, 30)
     * ```
     * Utilizando configurações de tentativas personalizadas
     * ```js
     * const writeValue = await this.ReadHoldingRegisters(0x30, 30, 1, 1)
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
     */
    async ReadHoldingRegisters(startAddress, qty, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.ReadHoldingRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.READ_HOLDING_REGISTERS_REQ, { startAddress, qty, tagName: this.TAG })
            Log.console(`MDB F03 ${this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) Qty => ${qty}`, this.Log.req)

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
     * Escreve um valor em um único registrador
     * @param {Number} startAddress Endereço inicial de escrita
     * @param {Number} value Valor que será enviado ao dispositivo
     * @param {Number} tryNumber Número de tentativas para realizar a escrita
     * @param {Number} maxTries Contador de tentativas
     * @returns Object 
     * 
     * # Exemplos
     * 
     * Utilizando configurações de tentativas default
     * ```js
     * const writeValue = await this.WriteSingleRegister(0x30, 30)
     * ```
     * Utilizando configurações de tentativas personalizadas
     * ```js
     * const writeValue = await this.WriteSingleRegister(0x30, 30, 1, 1)
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
     */
    async WriteSingleRegister(startAddress, value, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.WriteSingleRegisterResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTER_REQ, { startAddress, value, tagName: this.TAG })
            Log.console(`MDB F06 ${this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) value => ${value}`, this.Log.req)

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
     * Escreve um valor em um múltiplos registradores
     * @param {Number} startAddress Endereço inicial de escrita
     * @param {Array} arrValues Valores que serão enviados ao dispositivo
     * @param {Number} tryNumber Número de tentativas para realizar a escrita
     * @param {Number} maxTries Contador de tentativas
     * @returns Object 
     * 
     * # Exemplos
     * 
     * Utilizando configurações de tentativas default
     * ```js
     * const writeValues = await this.WriteMultipleRegisters(0x30, [1, 10, 30])
     * ```
     * Utilizando configurações de tentativas personalizadas
     * ```js
     * const writeValues = await this.WriteMultipleRegisters(0x30, [1, 10, 30], 1, 1)
     * ```
     * 
     * # Result
     * 
     * ```js
     * {path: String, success: Boolean, msg: String}
     * ```
     */
    async WriteMultipleRegisters(startAddress, arrValues, tryNumber = 1, maxTries = 3) {
        return new Promise(async (resolve) => {
            while (this.Busy) { await SerialUtil.Delay(10) }

            this.Busy = true
            const timeout = setTimeout(() => { this.WriteMultipleRegistersResult = { success: false, msg: `${this.TAG}: Dispositivo não respondeu (timeout)` } }, Modbus.RESPONSE_TIMEOUT)

            Socket.IO.emit(Socket.Events.WRTIE_HOLDING_REGISTERS_REQ, { startAddress, arrValues, tagName: this.TAG })
            Log.console(`MDB F16 ${this.PORT.path} ${this.TAG}: Addr => ${startAddress} (0x${SerialUtil.intBuffToStr([startAddress], SerialUtil.DataTypes.WORD)}) arrValues => [${arrValues}]`, this.Log.req)

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