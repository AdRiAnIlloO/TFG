// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
$(function () {
	var $g_pongIFrame = $('#pong-game-html-wrapper').contents();

	$('#qr-auth-html-wrapper').load('qr-auth.html', function () {
		function onQRUserDetected_Playing(event, result) {
			// Place controlled QR code according to scanned one's origin
			$g_pongIFrame.find('body').trigger('externalMove',
				[result.points[1].x, result.points[1].y]);
		}

		// Callback when QR auth + welcome screens are completed by the user
		function onQRStepsCompleted(event, qrImgURL) {
			// Fill player block with user QR image
			$g_pongIFrame.find('#bloque_jugador').html('<img src="' + qrImgURL + '" />');

			// HACK
			$g_pongIFrame.find('#video_camara').prop('hidden', true);

			$(document).on('qrUserDetected', onQRUserDetected_Playing);
		}

		$(document).on('qrStepsCompleted', onQRStepsCompleted);
	});
});
