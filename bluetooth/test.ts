// =============================================================================
// test.ts — Test program for the fisicabit-bluetooth extension
// =============================================================================
// HOW TO RUN: open this repository as a project in MakeCode (Import → Import
// URL); the simulator runs this file. Or download the .hex to a micro:bit V2
// and read the serial console at 115200 baud.
// WHAT TO EXPECT: three lines "TEST n ...: PASS" on the serial console and a
// tick on the display. Data only reaches fisicabit.com when the page is
// connected over Bluetooth, so sending blocks are only checked for not
// crashing. FAIL = an assertion below fails or the program stops with an error.
// =============================================================================

let failures = ""
function expectTrue(label: string, cond: boolean): void { if (!cond) failures += label + "; " }
function report(n: number, name: string): void {
    serial.writeLine("TEST " + n + " " + name + ": " + (failures == "" ? "PASS" : "FAIL(" + failures + ")"))
    basic.showIcon(failures == "" ? IconNames.Yes : IconNames.No)
    failures = ""
}

// TEST 1: the transport is registered in fisicabit-sensores at start-up, so the
// "send ... via [Bluetooth]" blocks of kinematics, ToF and ultrasonic use it.
expectTrue("transport registered", fisicabitData.bluetoothAvailable())
report(1, "transport registered in fisicabit-sensores")

// TEST 2: UART service and every sending block run without crashing.
fisicabitBluetooth.quickStart()
fisicabitBluetooth.showIcons(false)
fisicabitBluetooth.setDecimals(1)
fisicabitBluetooth.setRate(FbSampleRate.Hz100)
fisicabitBluetooth.sendTimestamp(true)
fisicabitBluetooth.resetTime()
let connected = fisicabitBluetooth.isConnected()
fisicabitBluetooth.send1(1.5, 10)
fisicabitBluetooth.send2(1, 2, 10)
fisicabitBluetooth.send3(1, 2, 3, 10)
fisicabitBluetooth.send4(1, 2, 3, 4, 10)
fisicabitBluetooth.sendWithoutTime1(3)
fisicabitBluetooth.sendWithoutTime2(3, 4)
fisicabitBluetooth.sendText("# bluetooth test")
let t = fisicabitBluetooth.time()
expectTrue("bluetooth time 0..2000 ms", t >= 0 && t < 2000)
serial.writeLine("  bluetooth connected=" + connected)
report(2, "fisicabitBluetooth sending blocks")

// TEST 3: a fisicabit-sensores block with the Bluetooth channel goes through
// this extension and returns (sendVelocity waits one sampling period).
fisicabitKinematics.start()
fisicabitKinematics.sendVelocity(FbAccelerationAxis.X, FbChannel.Bluetooth, 20)
fisicabitKinematics.sendAcceleration(FbAccelerationAxis.Vertical, FbChannel.Bluetooth, 20)
expectTrue("kinematics via Bluetooth returned", true)
report(3, "kinematics send via Bluetooth")

basic.forever(function () {
    fisicabitBluetooth.send1(input.acceleration(Dimension.X), 100)
})
