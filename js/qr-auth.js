// Use strict mode globally
"use strict";

// Global authed User instance
var g_AuthedUser = null;

function User(name, pass, encodedAuth) {
	if (encodedAuth == null) {
		this.name = name;
		this.pass = pass; // Ciphered pass
	} else {
		var authData = encodedAuth.split(" ");
		this.name = authData[0];
		this.pass = authData[1]; // Ciphered pass
	}
}

// Section of User functions that are defined once and shared across instances
{
	// Return an encoded auth to be embedded in QR
	User.prototype.buildEncodedAuth = function () {
		return (this.name + " " + this.pass);
	}
}

// Return an array of registered users from browser session.
// JSON can only transport name and pass (not functions)!
function getSessionUsers() {
	return (JSON.parse(window.sessionStorage.getItem('users')) || []);
}

// Add an User to the registered users array of session storage
function addSessionUser(user) {
	var users = getSessionUsers();
	users.push(user);
	window.sessionStorage.setItem('users', JSON.stringify(users));
}

// Returns a registered User instance whose name matches the parameter, null if not found
function findSessionUserByName(name) {
	var users = getSessionUsers();
	var foundUser = null;

	users.forEach(function (user) {
		if (user.name === name) {
			foundUser = user;
			return;
		}
	});

	return foundUser;
}

function hasLocalStorage() {
	return window.Storage;
}

// Document is ready, callback
$(function () {
	$('#auth-popup').modal();

	if (hasLocalStorage()) {
		// Auth form's submit doesn't know if user clicked login or register.
		// Use this as generic error set from login/register click handlers
		var authErrorMsg;

		$('#login').click(function () {
			var jsonUser = findSessionUserByName($('input[name=user]').val());

			if (jsonUser != null) {
				var auxUser = new User(jsonUser.name, $('input[name=pass]').val());

				if (auxUser.pass == jsonUser.pass) {
					g_AuthedUser = auxUser;
					authErrorMsg = null;
				} else {
					authErrorMsg = "Error de acceso: credenciales inválidas";
				}
			} else {
				authErrorMsg = "Error de acceso: usuario no registrado";
			}

			// To prevent submit action-chain from executing, return false
		});

		$('#register').click(function () {
			var inputName = $('input[name=user]').val();
			g_AuthedUser = findSessionUserByName(inputName);

			if (g_AuthedUser == null) {
				g_AuthedUser = new User(inputName, $('input[name=pass]').val());
				addSessionUser(g_AuthedUser);
				authErrorMsg = null;
			} else {
				authErrorMsg = "Error de acceso: usuario ya existente";
			}

			// To prevent submit action-chain from executing, return false
		});
	}

	$('#auth-form').submit(function (event) {
		event.preventDefault(); // Prevent reload page (always)

		if (authErrorMsg != null) {
			$('#auth-errors').show();
			$('#auth-errors').html(authErrorMsg);
			return;
		}

		$('#qr-code-gen-html-wrapper').load('qr-code-gen.html', function () {
			$('#auth-popup').modal('hide');
			$('#collapsible-capture-feedback').hide(); // Allow interacting with ongoing welcome modal
			setUpQRGeneration(g_AuthedUser);
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
	// This function respects possible User already authenticated, without overriding it
	qrcode.callback = function (result) {
		var auxUser = new User(null, null, result.decodedStr);
		var foundUser = findSessionUserByName(auxUser.name);

		if (foundUser == null) {
			return;
		} else if (g_AuthedUser == foundUser) {
			// Matches authenticated User
		} else if (g_AuthedUser != null || foundUser.pass !== auxUser.pass) {
			return;
		} else {
			// Authenticate user via QR
			authErrorMsg = null;
			g_AuthedUser = auxUser;
			$('#auth-form').submit();
		}

		// Pay special attention that data must be wrapped in an array
		$(document).trigger('qrUserDetected', [result]);
	};
})
