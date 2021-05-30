const debug = require('debug')('scrcpy')
const fixPath = require('fix-path')
const { spawn, exec } = require('child_process')
const log = require('electron-log');
const process = require('process');

fixPath()
const fs = require('fs')
const open = ({ sender }, options) => {
	const args = []
	const { config, devices } = options
	const { title, source, record, screen, fixed, control, touch, render, bitRate, maxSize, maxFps, orientation, crop, window, border, fullscreen, awake } = config
	const { open, openMirror, filepath } = record

	var spath = getScrcpyPath()
	let cmd = 'scrcpy'
	if (spath) {
		const scrcpyPath = `${spath}\\scrcpy.exe`
		if (!fs.existsSync(scrcpyPath)) {
			sender.send('error', { type: 'unknownScrcpyPathException' })
			return
		}
		cmd = scrcpyPath
	}

	args.push('--shortcut-mod=lctrl,rctrl')
	if (title !== '') {
		args.push('--window-title')
		args.push(title)
	}

	if (open) {
		if (!openMirror) {
			args.push('--no-display')
		}
		args.push('--record')
		args.push(filepath)
	}
	if (screen) {
		args.push('--turn-screen-off')
	}
	if (fixed) {
		args.push('--always-on-top')
	}
	if (!border) {
		args.push('--window-borderless')
	}
	if (fullscreen) {
		args.push('--fullscreen')
	}
	if (awake) {
		args.push('--stay-awake')
	} else if (!control) {
		args.push('--no-control')
	}
	if (touch) {
		args.push('--show-touches')
	}
	if (render) {
		args.push('--render-expired-frames')
	}
	if (bitRate !== 8) {
		args.push('--bit-rate')
		args.push(`${bitRate}M`)
	}
	if (maxSize !== 0) {
		args.push('--max-size')
		args.push(`${maxSize}`)
	}
	if (maxFps !== 0) {
		args.push('--max-fps')
		args.push(`${maxFps}`)
	}
	if (orientation !== 0) {
		args.push('--rotation')
		args.push(`${orientation}`)
	}
	{
		const { x, y, height, width } = crop
		if (height !== 0 || width !== 0) {
			args.push('--crop')
			args.push(`${height}:${width}:${x}:${y}`)
		}
	}
	{
		const { x, y, height, width } = window
		if (x !== 0 || y !== 0) {
			args.push('--window-x')
			args.push(`${x}`)
			args.push('--window-y')
			args.push(`${y}`)
		}
		if (height !== 0 || width !== 0) {
			args.push('--window-width')
			args.push(`${width}`)
			args.push('--window-height')
			args.push(`${height}`)
		}
	}

	devices.forEach(({ id }) => {
		const scrcpy = spawn(cmd, [...args, '-s', `${id}`])

		let opened = false
		let exited = false
		scrcpy.stdout.on('data', (data) => {
			if (!opened) {
				sender.send('open', id)
				opened = true
			}
			openSndcpy(sender, id)
			console.log(`stdout: ${data}`)
		})
		scrcpy.on('error', (code) => {
			console.log(`child process close all stdio with code ${code}`)
			scrcpy.kill()
		})

		scrcpy.on('close', (code) => {
			console.log(`child process close all stdio with code ${code}`)
		})

		scrcpy.on('exit', (code) => {
			console.log(`child process exited with code ${code}`)
			if (!exited) {
				sender.send('close', { success: code === 0, id })
				scrcpy.kill()
				exited = true
			}
		})
	})

}


function execPromise(command) {
	return new Promise(function (resolve, reject) {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(stdout.trim());
		});
	});
}

async function openSndcpy(sender, did) {
	var spath = getScrcpyPath()
	//声音  sndcpy
	let ADB = `${spath}\\adb.exe`
	let SNDCPY_APK = `${spath}\\sndcpy.apk`
	let SNDCPY_PORT = 28200
	try {
		var result = await execPromise(`${ADB} -s ${did} install -t -r -g ${SNDCPY_APK}`);
		log.info('result:' + result);
		var result1 = await execPromise(`${ADB} -s ${did} forward tcp:${SNDCPY_PORT} localabstract:sndcpy`);
		log.info('result1:' + result1);
		// var result2 = await execPromise(`${ADB} -s ${did} shell am start com.rom1v.sndcpy/.MainActivity`);
		// log.info('result2:' + result2);
	} catch (e) {
		log.error(e.message);
	}

}
function writeObj(obj) {
	var description = "";
	for (var i in obj) {
		var property = obj[i];
		description += i + " = " + property + "\n";
	}
	return (description);
}

const openPhoneService = ({ sender }, options) => {
	log.error("switchAudio------device=" + writeObj(options));
	let device = options.device
	if (device == null) {
		log.error("device is null------");
		return;
	}
	let did = device.id
	var spath = getScrcpyPath()
	let ADB = `${spath}\\adb.exe`
	execPromise(`${ADB} -s ${did} shell am start com.rom1v.sndcpy/.MainActivity`).then();
}

function closeVLC(did) {
	var spath = getScrcpyPath()
	let ADB = `${spath}\\adb.exe`
	execPromise(`${ADB} -s ${did} shell am force-stop  com.rom1v.sndcpy`)
}

const switchAudio = ({ sender }, options) => {
	log.error("switchAudio------device=" + writeObj(options));
	let device = options.device
	if (device == null) {
		log.error("device is null------");
		return;
	}
	var spath = getScrcpyPath()
	let VLC = `${spath}\\VLCPortable\\App\\vlc\\vlc.exe`
	let SNDCPY_PORT = 28200


	log.error("device is " + device.enableAudio);
	const e = device.enableAudio == true ? true : false;
	if (!e) {
		closeVLC(device.id)
		return
	}
	try {
		let cmd = `${VLC} -Idummy --demux rawaud --network-caching=50 --play-and-exit tcp://localhost:${SNDCPY_PORT}`
		log.error("device is " + cmd);
		let child = exec(cmd, (error, stdout, stderr) => {
			log.error(child.pid)
		});
	} catch (e) {
		log.error(e.message);
	}

}

function isDebug() {
	const favor = process.env.FAVOR;
	console.log("favor: " + favor);
	return "debug" == favor;
	// return true;
}
function getScrcpyPath() {
	if (isDebug()) {
		return ".\\extraResources"
	} else {
		return process.resourcesPath + "/extraResources"
	}

}

export default {
	open,
	switchAudio,
	openPhoneService,
}
