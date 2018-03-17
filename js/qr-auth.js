// Use strict mode globally
"use strict";

var g_AuthedUser = null;

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

	$('#auth-form').submit(function (event) {
		event.preventDefault(); // Prevent reload page (always)

		if (authErrorMsg != null) {
			$('#auth-errors').show();
			$('#auth-errors').html(authErrorMsg);
			return;
		}

		g_AuthedUser = $('input[name=user]').val();
		var userEncodedAuth = $('input[name=user]').val();

		$('#qr-code-gen-html-wrapper').load('qr-code-gen.html', function () {
			$('#auth-popup').modal('hide');
			$('#collapsible-capture-feedback').hide(); // Allow interacting with ongoing welcome modal
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
	var showLiveCaptureTxt = $('#collapse-capture-btn').html();

	// Modify the live capture user-interactable section
	$('#collapse-capture-btn').click(function () {
		$qrCanvas.toggle();

		if ($qrCanvas.css('display') == 'none') {
			$(this).html(showLiveCaptureTxt);
		} else {
			$(this).html('Ocultar captura en vivo');
		}
	});

	// Copy captured image to canvas and scan QR from it (jsqrcode library requires it)
	function captureToCanvas_ScanQR() {
		var context = $qrCanvas[0].getContext('2d');
		var width = $qrCanvas.width();
		var height = $qrCanvas.height();
		context.drawImage($preview[0], 0, 0, width, height);

		// jsqrcode specific code
		try {
			qrcode.decode();
		} catch (error) {
			// Nothing
		}
	}

	$preview[0].addEventListener('play', function () {
		// Set up both internal canvas + outer visual necessary dimensions, proportional to original video
		var proportionalHeight = ($qrCanvas.width() * $preview.height() / $preview.width());
		$qrCanvas.prop('width', $qrCanvas.width());
		$qrCanvas.prop('height', proportionalHeight);
		$qrCanvas.height(proportionalHeight);
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
			if (g_AuthedUser == null) {
				authErrorMsg = null;
				$('input[name=user]').val(result.decodedStr);
				$('#auth-form').submit();
			}

			var context = $qrCanvas[0].getContext('2d');
			context.clearRect(result.points[0].x, result.points[0].y, 30, 30);

			// Pay special attention that data must be wrapped in an array
			$(document).trigger('qrUserDetected', [result]);
		}
	};
})
