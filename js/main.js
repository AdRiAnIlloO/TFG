// Use strict mode globally
"use strict";

// This script assumes UI toolkit dependencies are already loaded into the page
const X_DIM = 0;
const Y_DIM = 1;
var $g_pongJQuery = null;

// X and Y size ratios from auth QR canvas to game playable area
var g_playBoundsRatios = Array(2);

$(function () {
	// Pong game iframe is not fully load yet. Wait for it.
	$('#pong-game-html-wrapper').on('load', function () {
		$g_pongJQuery = $(this)[0].contentWindow;
		g_playBoundsRatios[X_DIM] = ($g_pongJQuery.$('#video_camara').width() / $('#qr-canvas').width());
		g_playBoundsRatios[Y_DIM] = ($g_pongJQuery.$('#video_camara').height() / $('#qr-canvas').height());
	});

	$('#qr-auth-html-wrapper').load('qr-auth.html', function () {
		function onQRUserDetected_Playing(event, result) {
			if ($g_pongJQuery != null) {
				// Calculate and place controlled QR code according to scanned one's origin,
				// and player block with from minigame
				var x = ((result.points[0].x + result.points[1].x) * g_playBoundsRatios[X_DIM] / 2);
				var y = ((result.points[0].y + result.points[1].y) * g_playBoundsRatios[Y_DIM] / 2);
				$g_pongJQuery.$('body').trigger('externalMove', [x, y]);
			}
		}

		// Callback when QR auth + welcome screens are completed by the user
		function onQRStepsCompleted(event, qrImgURL) {
			// Fill player block with user QR image
			$g_pongJQuery.$('#bloque_jugador').html('<img src="' + qrImgURL + '" />');

			$(document).on('qrUserDetected', onQRUserDetected_Playing);
		}

		$(document).on('qrStepsCompleted', onQRStepsCompleted);
	});
});
