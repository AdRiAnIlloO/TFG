// Use strict mode globally
"use strict";

// Global authed User instance
var g_AuthedUser = null;

// Console logging?
var g_bDebug = false;

// Authentications error, checked against null for advancing authentication form
var g_AuthErrorMsg = null;

// The QR welcome screen jQuery object, we load it only once the QR layer is completed by the user.
// This object would not be necessary if compatible local file mode wasn't needed, but as it requires use of iframes,
// its DOM is only accessible from a special attribute, so this provides an abstraction to hold the object in each mode.
var g_QrGenScreenObj = null;

// This indicates if apply fallback mechanisms due to security policy restrictions when accessing through local files
var g_bRunInLocalCompatMode = false;

function User(name, pass, encodedAuth) {
    if (encodedAuth == null) {
        this.name = name;
        this.setHashFromPlainPass(pass);
    } else {
        var authData = encodedAuth.split(" ");
        this.name = authData[0];
        this.passHash = authData[1];
    }
}

// Section of User functions that are defined once and shared across instances
{
    User.prototype.setHashFromPlainPass = function (pass) {
        this.passHash = new Hashes.MD5().hex(pass);
    }

    // Return an encoded auth to be embedded in QR
    User.prototype.buildEncodedAuth = function () {
        return (this.name + " " + this.passHash);
    }
}

// Return an array of registered users from browser session.
// JSON can at least transport attributes (but not functions!)
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
        $('#login').click(function () {
            var jsonUser = findSessionUserByName($('input[name=user]').val());

            if (jsonUser != null) {
                var auxUser = new User(jsonUser.name, $('input[name=pass]').val());

                if (auxUser.passHash == jsonUser.passHash) {
                    g_AuthedUser = auxUser;
                    g_AuthErrorMsg = null;
                } else {
                    g_AuthErrorMsg = "Error de acceso: credenciales inválidas";
                }
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario no registrado";
            }

            // To prevent submit action-chain from executing, return false
        });

        $('#register').click(function () {
            var inputName = $('input[name=user]').val();
            g_AuthedUser = findSessionUserByName(inputName);

            if (g_AuthedUser == null) {
                g_AuthedUser = new User(inputName, $('input[name=pass]').val());
                addSessionUser(g_AuthedUser);
                g_AuthErrorMsg = null;
            } else {
                g_AuthErrorMsg = "Error de acceso: usuario ya existente";
            }

            // To prevent submit action-chain from executing, return false
        });
    }

    // This is called for both form authentications and QR scans access.
    function onUserAuthenticated() {
        $('#auth-popup').modal('hide');

        // This is required to allow user clicking in the next modal (generated QR welcome screen)
        $('#collapsible-capture-feedback').hide();

        // Try classical load
        $('#qr-code-gen-html-wrapper').load('qr-code-gen.html', function (responseText, textStatus) {
            if (textStatus === "error") {
                // Classical load failed. We load the fallback welcome QR generation screen by setting a proper src...
                $('#qr-code-gen-html-fallback-wrapper').prop('src', 'qr-code-gen.html');

                // ...And wait for it to fully load
                $('#qr-code-gen-html-fallback-wrapper').on('load', function () {
                    g_bRunInLocalCompatMode = true;
                    g_QrGenScreenObj = $(this)[0].contentWindow;

                    // Standard way to send messages to iframe?
                    // buildEncodedAuth is not serializable, send the encoded auth already
                    g_QrGenScreenObj.postMessage(JSON.stringify([g_AuthedUser.name, g_AuthedUser.buildEncodedAuth()]),
                        '*');
                });
            } else {
                g_bRunInLocalCompatMode = false;
                g_QrGenScreenObj = $(this);

                // Start up the generated QR welcome screen. We could send the user object here if iframe fallback
                // was not needed, because the loaded content would have access to the User object, and buildEncodedAuth
                setUpQRGeneration(g_AuthedUser.name, g_AuthedUser.buildEncodedAuth());
            }
        });
    }

    $('#auth-form').submit(function (event) {
        event.preventDefault(); // Prevent reload page (always)

        if (g_AuthErrorMsg != null) {
            $('#auth-errors').show();
            $('#auth-errors').html(g_AuthErrorMsg);
        } else {
            onUserAuthenticated();
        }
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

        try {
            // jsqrcode specific code
            qrcode.decode();
        } catch (error) {
            if (g_bRunInLocalCompatMode) {
                window.parent.postMessage(JSON.stringify(['qr_user_invalid_or_undetected']), '*');
            } else {
                $(document).trigger('qr_user_invalid_or_undetected');
            }
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
        if (g_bDebug) {
            console.log("Scanned QR code decoded string = " + result.decodedStr);

            var context = $qrCanvas[0].getContext('2d');
            context.beginPath();
            context.arc(result.points[0].x, result.points[0].y, 5, 0, 2 * Math.PI);
            context.arc(result.points[1].x, result.points[1].y, 5, 0, 2 * Math.PI);
            context.arc(result.points[2].x, result.points[2].y, 5, 0, 2 * Math.PI);
            context.stroke();
            return;
        }

        var auxUser = new User(null, null, result.decodedStr);

        // Are we in a live user session already?
        if (g_AuthedUser != null) {
            // Yes. Credentials of checked QR user must match with the session user's.
            if (auxUser.passHash !== g_AuthedUser.passHash) {
                // Full credentials are incorrect
                throw 'qr_user_invalid';
            }
        } else {
            // No live session is active. Search for a registered user with that name.
            var foundUser = findSessionUserByName(auxUser.name);

            if (foundUser == null) {
                // No registered user found with that name
                throw 'qr_user_undetected';
            }

            if (foundUser.passHash !== auxUser.passHash) {
                // Full credentials are incorrect
                throw 'qr_user_invalid';
            }

            // Pass user authentication via QR
            g_AuthErrorMsg = null;
            g_AuthedUser = auxUser;
            onUserAuthenticated();
        }

        // Send message about that an existing user was detected and validated in this frame via QR.
        // Pay special attention that data must be wrapped in an array.
        if (g_bRunInLocalCompatMode) {
            window.parent.postMessage(JSON.stringify(['qr_user_detected', result]), '*');
        } else {
            $(document).trigger('qr_user_detected', [result]);
        }
    };

    //////////////////////////////////////////////////////////////////////
    ////////////               Iframe fallbacks               ////////////
    //////////////////////////////////////////////////////////////////////

    // This function is necessary in order to forward desired events to parent from layers belos this iframe view
    window.addEventListener('message', function (e) {
        window.parent.postMessage(e.data, '*');
    }, false);

    // Inform to the main layer of the QR video dimensions
    window.parent.postMessage(JSON.stringify(['qr_auth_layer_loaded', $('#qr-canvas').width(),
        $('#qr-canvas').height()]), '*');
})
