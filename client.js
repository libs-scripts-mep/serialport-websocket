import Log from "../script-loader/utils-script.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js"
import { RastUtil } from "../rast-pvi/rast-pvi.js"
import { SerialUtil } from "./serial.js"

export class Socket {
    static ServerPort = 3000
    static IO = io(`http://localhost:${this.ServerPort}`)
    static Error = null
    static PortList = null
    static Slaves = null
    static OpenPorts = null
    static ActiveSlaves = null
    static DebugMode = false
    static CriticalErrors = ["Writing to COM port (GetOverlappedResult): Unknown error code 31"]

    static RESPONSE_TIMEOUT = 500
    static Events = {
        //Global socket commands
        KILL_PROCESS: "kill-process",
        SERVER_ERROR: "server-error",
        PORTLIST_REQ: "port-list-req",
        PORTLIST_RES: "port-list-res",
        OPENPORTS_REQ: "get-openports-req",
        OPENPORTS_RES: "get-openports-res",
        ACTIVE_SLAVE_REQ: "active-slave-req",
        ACTIVE_SLAVE_RES: "active-slave-res",
        //Commom serial commands
        OPEN_PORT_REQ: "open-port-req",
        OPEN_PORT_RES: "open-port-res",
        CLOSE_PORT_REQ: "close-port-req",
        CLOSE_PORT_RES: "close-port-res",
        READ_FROM_REQ: "rx-buffer-req",
        READ_FROM_RES: "rx-buffer-res",
        WRITE_TO_REQ: "tx-buffer-req",
        WRITE_TO_RES: "tx-buffer-res",
        //Modbus only commands
        OPEN_MODBUS_REQ: "open-mdb-slave-req",
        OPEN_MODBUS_RES: "open-mdb-slave-res",
        CLOSE_MODBUS_REQ: "close-mdb-slave-req",
        CLOSE_MODBUS_RES: "close-mdb-slave-res",
        FREE_SLAVE_REQ: "free-mdb-slave-req",
        FREE_SLAVE_RES: "free-mdb-slave-res",
        CREATE_MODBUS_REQ: "create-mdb-slave-req",
        CREATE_MODBUS_RES: "create-mdb-slave-res",
        SET_NODE_ADDRESS_REQ: "set-mdb-slave-addr-req",
        SET_NODE_ADDRESS_RES: "set-mdb-slave-addr-res",
        READ_DEVICE_ID_REQ: "read-device-id-req",
        READ_DEVICE_ID_RES: "read-device-id-res",
        READ_INPUT_REGISTERS_REQ: "read-mdb-input-regs-req",
        READ_INPUT_REGISTERS_RES: "read-mdb-input-regs-res",
        READ_HOLDING_REGISTERS_REQ: "read-mdb-holding-regs-req",
        READ_HOLDING_REGISTERS_RES: "read-mdb-holding-regs-res",
        WRTIE_HOLDING_REGISTER_REQ: "write-mdb-holding-reg-req",
        WRTIE_HOLDING_REGISTER_RES: "write-mdb-holding-reg-res",
        WRTIE_HOLDING_REGISTERS_REQ: "write-mdb-holding-regs-req",
        WRTIE_HOLDING_REGISTERS_RES: "write-mdb-holding-regs-res",
    }

    static async startObservers() {
        Socket.IO.on('connect', () => { Log.warn(`🟢 Connected to websocket-serialport server on port ${Socket.ServerPort}`, Log.Colors.Green.MediumSpringGreen) })
        Socket.IO.on('disconnect', () => { Log.warn(`🔴 Disconnected from server on port ${Socket.ServerPort}`, Log.Colors.Red.IndianRed) })
        Socket.IO.on(Socket.Events.PORTLIST_RES, (portList) => { console.log(portList); Socket.PortList = portList })
        Socket.IO.on(Socket.Events.OPENPORTS_RES, (openPorts) => { console.log(openPorts); Socket.OpenPorts = openPorts })
        Socket.IO.on(Socket.Events.ACTIVE_SLAVE_RES, (slaves) => { console.log(slaves); Socket.ActiveSlaves = slaves })
        Socket.IO.on(Socket.Events.SERVER_ERROR, (error) => { console.error(error); Socket.Error = error })

        Socket.IO.on(Socket.Events.OPEN_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.CLOSE_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.WRITE_TO_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.READ_FROM_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
    }

    static getPortList() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.PORTLIST_REQ)

            const timeout = setTimeout(() => { this.PortList = [] }, Socket.RESPONSE_TIMEOUT)
            while (this.PortList == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            resolve(this.PortList)
            this.PortList = null
        })
    }

    static getOpenPorts() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.OPENPORTS_REQ)

            const timeout = setTimeout(() => { this.OpenPorts = {} }, Socket.RESPONSE_TIMEOUT)
            while (this.OpenPorts == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            resolve(this.OpenPorts)
            this.OpenPorts = null
        })
    }

    static getActiveSlaves() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.ACTIVE_SLAVE_REQ)

            const timeout = setTimeout(() => { this.ActiveSlaves = {} }, Socket.RESPONSE_TIMEOUT)
            while (this.ActiveSlaves == null) { await SerialUtil.Delay(10) }
            clearTimeout(timeout)

            resolve(this.ActiveSlaves)
            this.ActiveSlaves = null
        })
    }

    static isCriticalError(error) {
        for (const critErr of this.CriticalErrors) {
            if (critErr == error) { return true }
        }
        return false
    }

    static async startProcess() {
        const start = Date.now()

        while (true) {
            const elapsed = Date.now() - start
            if (Socket.IO.connected) {
                Log.warn(`✅ serialport-websocket server already running on port ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
                return
            } else if (elapsed > 1000) {
                Log.warn(`⚙️ Starting serialport-websocket server on port ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
                FWLink.runInstructionS("EXEC",
                    [
                        "node",
                        `${RastUtil.getScriptPath()}/node_modules/@libs-scripts-mep/serialport-websocket/server.js ${Socket.ServerPort}`,
                        "true",
                        "true"
                    ],
                    () => { }
                )
                break
            }
            await SerialUtil.Delay(100)
        }
        return this.startProcess()
    }

    static killProcess() { Socket.IO.emit(Socket.Events.KILL_PROCESS) }

    static {
        window.WebsocketSerialPort = Socket

        Socket.startObservers()
        Socket.startProcess()

        FWLink.PVIEventObserver.add((message, params) => {
            if (params[0] != undefined && Socket.DebugMode) {
                Log.console(`${message} ${params[0]}`, Log.Colors.Purple.MediumPurple)
            }
        }, "PVI.Sniffer.sniffer.PID_")
    }
}