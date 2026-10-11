
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("application-form");

    if (!form) {
        console.error("Application form was not found.");
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );

    // Create a status message without changing the HTML layout.
    const statusMessage = document.createElement("p");
    statusMessage.setAttribute("role", "status");
    statusMessage.setAttribute("aria-live", "polite");
    statusMessage.style.marginTop = "16px";
    form.appendChild(statusMessage);

    function showMessage(message, isError = false) {
        statusMessage.textContent = message;
        statusMessage.style.color = isError ? "#F87171" : "#A5B4FC";
    }

    async function uploadFile(file, path) {
        const { error } = await supabaseClient.storage
            .from("application-documents")
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false
            });

        if (error) throw error;

        return path;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const submitButton = form.querySelector(
            'button[type="submit"], input[type="submit"]'
        );

        const fullName = document.getElementById("full-name").value.trim();
        const email = document.getElementById("email").value.trim();
        const academicLevel = document.getElementById("level").value;
        const interest = document.getElementById("interest").value;
        const certificate = document.getElementById("registration-certificate").files[0];
        const photo = document.getElementById("personal-photo").files[0];
        const motivation = document.getElementById("message").value.trim();

        if (!certificate || !photo) {
            showMessage("Please upload both required files.", true);
            return;
        }

        const allowedCertificateTypes = ["application/pdf"];
        const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        if (!allowedCertificateTypes.includes(certificate.type)) {
            showMessage("The registration certificate must be a PDF.", true);
            return;
        }

        if (!allowedPhotoTypes.includes(photo.type)) {
            showMessage("The photo must be JPG, PNG, or WEBP.", true);
            return;
        }

        if (certificate.size > maxFileSize || photo.size > maxFileSize) {
            showMessage("Each file must be smaller than 10 MB.", true);
            return;
        }

        if (submitButton) submitButton.disabled = true;
        showMessage("Submitting your application…");

        const applicationId = crypto.randomUUID();
        const folder = `applications/${applicationId}`;

        try {
            // Upload both documents to the private bucket.
            const certificatePath = await uploadFile(
                certificate,
                `${folder}/registration-certificate.pdf`
            );

            const photoExtension = {
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/webp": "webp"
            }[photo.type];

            const photoPath = await uploadFile(
                photo,
                `${folder}/personal-photo.${photoExtension}`
            );

            // Save the application details in the database.
            const { error } = await supabaseClient
                .from("applications")
                .insert({
                    full_name: fullName,
                    email: email,
                    academic_level: academicLevel,
                    interest: interest,
                    registration_certificate_path: certificatePath,
                    personal_photo_path: photoPath,
                    motivation: motivation,
                    status: "pending"
                });

            if (error) throw error;

            showMessage(
                "Your application has been submitted successfully. Thank you!"
            );

            form.reset();
        } catch (error) {
            console.error("Application submission failed:", error);
            showMessage(
                "We couldn't submit your application. Please try again. If the problem continues, contact the club.",
                true
            );
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
});
