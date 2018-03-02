// Use strict mode globally
"use strict";

$(function () {
	$('#qr-gen-modal-close-btn').click(function () {
		$('#qr-gen-modal').modal('hide');
		$(document).trigger('qrStepsCompleted', [$('#qr-gen-auth-code').prop('src')]);
	});
})

function setUpQRGeneration(userName, userEncodedAuth) {
	$('#qr-gen-modal').modal();
	$('#qr-gen-modal .modal-title').html("¡Hola, " + userName
		+ "! Con el código que se muestra abajo podrás acceder mostrándolo a la cámara cuando vuelvas a conectarte."
		+ " Sugerencia: fotografíalo.");
	$('#qr-gen-auth-code').prop('src',
		"https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=" + userEncodedAuth);
	$('#qr-gen-modal .modal-footer').html();
}
