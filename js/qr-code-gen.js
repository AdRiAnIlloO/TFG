// Use strict mode globally
"use strict";

function onGenerationQrImageLoaded() {
        // Begin obtaining a data URL of the loaded image to succeed on the
        // same-origin policy restriction on raw external URL downloads
        let $canvas = $('<canvas>');
        $canvas.prop('width', $(this).prop('width')); // CSS equivalent = 0
        $canvas.prop('height', $(this).prop('height')); // CSS equivalent = 0
        let context = $canvas[0].getContext('2d');
        context.drawImage($(this)[0], 0, 0);

        try {
            let qrImageDataUrl = $canvas[0].toDataURL(); // PNG is the default
            $('#save_qr_image_btn').show();
            $('#save_qr_image_btn').prop('href', qrImageDataUrl);
        } catch(error) {
            console.log(error);
        }
}

$(function () {
    function setUpQRGeneration(userName, userEncodedAuth) {
        $('#qr-gen-modal').modal();
        $('#qr-gen-modal .modal-title').html("¡Hola, " + userName
            + "! Con el código que se muestra abajo podrás acceder mostrándolo \
            a la cámara cuando vuelvas a conectarte. Sugerencia: fotografíalo.");
        $('#qr_gen_auth_code').prop('src', "https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl="
            + userEncodedAuth);
        $('#qr_gen_auth_code').on('load', onGenerationQrImageLoaded);
    }

    $('#qr_gen_modal_close_btn').click(function () {
        $('#qr-gen-modal').modal('hide');

        window.parent.postMessage(JSON.stringify(['qr_steps_completed', $('#qr_gen_auth_code').prop('src')]), '*');
    });

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    // Listen to messages from parent window.
    // Assumming it's a message with user for setUpQRGeneration.
    window.addEventListener('message', function (event) {
        var dataArray = JSON.parse(event.data);
        var name = dataArray[0];

        switch (name) {
            case 'set_up_qr_generation': {
                setUpQRGeneration(dataArray[1], dataArray[2]);
                break;
            }
        }
    }, false);

    // This event ensures further postMessages will be always receiveable at this point
    window.parent.postMessage(JSON.stringify(['qr_generation_ready']), '*');
})
