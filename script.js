const joinButton = document.querySelector(".join-button");

if (joinButton) {

    console.log(joinButton);

    joinButton.addEventListener("click", function () {

        if (joinButton.classList.contains("joined")) {
            joinButton.textContent = "Join PHYSICS CLUB";
            joinButton.classList.remove("joined");
        } else {
            joinButton.textContent = "✓ JOINED";
            joinButton.classList.add("joined");
        }

    });

}

const applicationForm = document.querySelector("#application-form");

console.log(applicationForm);

if (applicationForm) {

    applicationForm.addEventListener("submit", function (event) {

        event.preventDefault();

        const fullName = document.querySelector("#full-name").value;

        console.log(fullName);

        console.log("Application submitted");

    });

}