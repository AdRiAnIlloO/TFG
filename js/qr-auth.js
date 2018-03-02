// Use strict mode globally
"use strict";

$(function () {
	function hasLocalStorage() {
		return window.Storage;
	}

	function getUsers() {
		return (JSON.parse(window.sessionStorage.getItem('users')) || []);
	}

	function findUser(user) {
		return getUsers().indexOf(user);
	}

	$('#auth-popup').modal();

	if (hasLocalStorage()) {
		function updateUsersJSON(users) {
			window.sessionStorage.setItem('users', JSON.stringify(users));
		}

		// Auth form's submit doesn't know if user clicked login or register.
		// Use this as generic error set from login/register click handlers
		var authErrorMsg;

		$('#login').click(function () {
			// To prevent submit action-chain from executing, return false
			if (findUser($('input[name=user]').val()) != -1) {
				authErrorMsg = null;
			} else {
				authErrorMsg = "Error de acceso: usuario no registrado";
			}
		});

		$('#register').click(function () {
			// To prevent submit action-chain from executing, return false
			var users = getUsers();

			if (users.indexOf($('input[name=user]').val()) != -1) {
				authErrorMsg = "Error de acceso: usuario ya existente";
			} else {
				users.push($('input[name=user]').val());
				updateUsersJSON(users);
				authErrorMsg = null;
			}
		});
	}

	$('#auth-form').submit(function () {
		event.preventDefault(); // Prevent reload page (always)

		if (authErrorMsg) {
			window.alert(authErrorMsg);
			return;
		}

		var userEncodedAuth = $('input[name=user]').val();

		$('#qr-code-gen-html-wrapper').load('qr-code-gen.html', function () {
			$('#auth-popup').modal('hide');
			setUpQRGeneration($('input[name=user]').val(), userEncodedAuth)
		});
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

		// jsqrcode specific code
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
	});

	// jsqrcode specific code - result of the scanning of the embedded QR canvas 
	qrcode.callback = function (result) {
		if (findUser(result.decodedStr) != -1) {
			// Pay special attention that data must be wrapped in an array
			$(document).trigger('qrUserDetected', [result]);
		}
	};
})
