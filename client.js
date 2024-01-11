import Log from "../script-loader/utils-script.js"
import { RastUtil } from "../rast-pvi/rast-pvi.js"
import FWLink from "../daq-fwlink/FWLink.js"
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js"
import { SerialUtil } from "./serial.js"

export class Socket {
    static ServerPort = 3000
    static IO = io(`http://localhost:${this.ServerPort}`)
    static Error = null
    static PortList = null
    static Slaves = null
    static OpenPorts = null
    static DebugMode = false
    static CriticalErrors = ["Writing to COM port (GetOverlappedResult): Unknown error code 31"]

    static Events = {
        //Global socket commands
        KILL_PROCESS: "kill-process",
        SERVER_ERROR: "server-error",
        PORTLIST_REQ: "port-list-req",
        PORTLIST_RES: "port-list-res",
        OPENPORTS_REQ: "get-openports-req",
        OPENPORTS_RES: "get-openports-res",
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
        Socket.IO.on(Socket.Events.PORTLIST_RES, (portList) => { console.log(portList); Socket.PortList = portList })
        Socket.IO.on(Socket.Events.OPENPORTS_RES, (openPorts) => { console.log(openPorts); Socket.OpenPorts = openPorts })
        Socket.IO.on(Socket.Events.SERVER_ERROR, (error) => { console.error(error); Socket.Error = error })

        Socket.IO.on(Socket.Events.OPEN_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.CLOSE_PORT_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.WRITE_TO_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
        Socket.IO.on(Socket.Events.READ_FROM_RES, (res) => { if (res.path == "Unknown") { console.log(res) } })
    }

    static getPortList() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.PORTLIST_REQ)

            while (this.PortList == null) { await SerialUtil.Delay(10) }

            resolve(this.PortList)
            this.PortList = null
        })
    }

    static getOpenPorts() {
        return new Promise(async (resolve) => {
            Socket.IO.emit(Socket.Events.OPENPORTS_REQ)

            while (this.OpenPorts == null) { await SerialUtil.Delay(10) }

            resolve(this.OpenPorts)
            this.OpenPorts = null
        })
    }

    static isCriticalError(error) {
        for (const critErr of this.CriticalErrors) {
            if (critErr == error) { return true }
        }
        return false
    }

    static startProcess() {
        setTimeout(() => {
            if (!Socket.IO.connected) {
                Log.console(`Subindo servidor serialport-websocket na porta ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
                FWLink.runInstructionS("EXEC",
                    [
                        "node",
                        `${RastUtil.getScriptPath()}/node_modules/@libs-scripts-mep/serialport-websocket/server.js ${Socket.ServerPort}`,
                        "true",
                        "true"
                    ],
                    () => { }
                )
            } else {
                Log.console(`Servidor serialport-websocket já está em execução na porta ${Socket.ServerPort}`, Log.Colors.Orange.Orange)
            }
        }, 1000)
    }

    static killProcess() { Socket.IO.emit(Socket.Events.KILL_PROCESS) }

    static {
        window.Socket = Socket
        window.onbeforeunload = () => { return Socket.killProcess() }
        window.onkeydown = (e) => { if (e.keyCode == 65 && e.ctrlKey) { window.onbeforeunload = () => { } } }
        window.onkeydown = (e) => { if ((e.which || e.keyCode) == 116) { window.onbeforeunload = () => { } } }

        Socket.startObservers()
        Socket.startProcess()

        FWLink.PVIEventObserver.add((message, params) => {
            if (params[0] != undefined && Socket.DebugMode) {
                Log.console(`${message} ${params[0]}`, Log.Colors.Purple.MediumPurple)
            }
        }, "PVI.Sniffer.sniffer.PID_")
    }
}