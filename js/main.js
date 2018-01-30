// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
$(function () {
	$('#auth-popup').modal();

	$('#login').click(function () {
		// TODO: Handle login attempt.
		// To prevent submit function from getting called, return false
		return true;
	});

	$('#register').click(function () {
		// TODO: Handle register attempt.
		// To prevent submit function from getting called, return false
		return true;
	});

	$('#auth-form').submit(function () {
		window.alert("Codificando valor: \"" + $('input[name=user]').val() + "\" en el codigo QR");
		$('#qrcode').html('<img src="https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=adrian" alt="Code to scan" />');
		event.preventDefault(); // Prevent reload page
		$('#auth-popup').modal('hide');
	});

	Instascan.Camera.getCameras().then(function (cameras) {
		if (0 < cameras.length) {
			let scanner = new Instascan.Scanner({
				video: document.getElementById('preview'),
				refractoryPeriod: 1
			});

			scanner.start(cameras[0]);
		}
	});

	var $preview = $('#preview');
	var $qrCanvas = $('#qr-canvas');

	// Copy captured image to canvas and scan QR from it (jsqrcode library requires it)
	function captureToCanvas_ScanQR() {
		var context = $qrCanvas[0].getContext('2d');
		var width = $qrCanvas.attr('width');
		var height = $qrCanvas.attr('height');
		context.fillRect(0, 0, width, height);
		context.drawImage($preview[0], 0, 0, width, height);

		try {
			qrcode.decode();
		} catch (error) {
			// Nothing
		}
	}

	$preview[0].addEventListener('play', function () {
		$qrCanvas.attr('width', $preview.width());
		$qrCanvas.attr('height', $preview.height());
		setInterval(captureToCanvas_ScanQR, 1);
	});

	$preview[0].addEventListener('pause', function () {
		// If video pauses, stop QR process interval
		clearInterval(captureToCanvas_ScanQR);
	});

	$preview[0].addEventListener('ended', function () {
		// If video ends, stop QR process interval
		clearInterval(captureToCanvas_ScanQR);
	})

	// Libreria jsqrcode - resultado de escaneo del nombre usuario en codigo QR
	qrcode.callback = function (result) {
		// Place controlled QR code according to scanned one's origin
		$('#qrcode').css({ left: result.points[1].x, top: result.points[1].y });
	};
});