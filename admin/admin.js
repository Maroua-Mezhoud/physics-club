
"use strict";

/*
 * PHYSICS CLUB — Admin dashboard prototype
 *
 * IMPORTANT:
 * All data below is fictional demo data.
 * Changes exist only in the current page session.
 * This prototype is not connected to Supabase.
 */

const demoApplications = [
    {
        id: 1001,
        name: "Lina Benali",
        email: "lina.demo@example.com",
        type: "student",
        level: "Licence 2",
        submitted: "2026-10-08",
        interests: ["Physics", "Scientific Research"],
        status: "pending",
        motivation:
            "I would like to explore physics beyond the classroom, collaborate with other students, and take part in scientific projects."
    },
    {
        id: 1002,
        name: "Adam Mansouri",
        email: "adam.demo@example.com",
        type: "student",
        level: "Licence 3",
        submitted: "2026-10-07",
        interests: ["Programming", "Computational Simulations"],
        status: "accepted",
        motivation:
            "I am interested in using programming to model physical systems and develop interactive simulations for students."
    },
    {
        id: 1003,
        name: "Sara Haddad",
        email: "sara.demo@example.com",
        type: "student",
        level: "Master 1",
        submitted: "2026-10-06",
        interests: ["Quantum Physics", "Scientific Research"],
        status: "pending",
        motivation:
            "I hope to deepen my understanding of modern physics and work with other students on computational projects."
    },
    {
        id: 1004,
        name: "Yanis Karim",
        email: "yanis.demo@example.com",
        type: "student",
        level: "Licence 1",
        submitted: "2026-10-05",
        interests: ["Astronomy", "Physics"],
        status: "rejected",
        motivation:
            "I want to discover more areas of physics and learn how scientific ideas can be explored through practical projects."
    },
    {
        id: 1005,
        name: "Dr. Nadia Example",
        email: "nadia.faculty@example.com",
        type: "faculty",
        level: "Faculty / Supervisor",
        submitted: "2026-10-04",
        interests: ["Scientific Research", "Supervision"],
        status: "pending",
        motivation:
            "I am interested in supporting student research, advising computational physics projects, and encouraging scientific collaboration."
    },
    {
        id: 1006,
        name: "Meriem Saleh",
        email: "meriem.demo@example.com",
        type: "student",
        level: "Master 2",
        submitted: "2026-10-03",
        interests: ["Programming", "Physics"],
        status: "accepted",
        motivation:
            "I would like to contribute to the club's educational resources and help build useful tools for learning physics."
    },
    {
        id: 1007,
        name: "Omar Example",
        email: "omar.demo@example.com",
        type: "student",
        level: "Licence 2",
        submitted: "2026-10-02",
        interests: ["Computational Simulations", "Programming"],
        status: "pending",
        motivation:
            "I want to learn scientific programming and participate in projects that turn mathematical models into interactive visualizations."
    }
];

let applications = demoApplications.map(application => ({
    ...application,
    interests: [...application.interests]
}));

let selectedApplicationId = null;
let toastTimeout = null;

/* ------------------------------
   DOM helpers
------------------------------ */

const $ = selector => document.querySelector(selector);

const $$ = selector => [...document.querySelectorAll(selector)];

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function getInitials(name) {
    return String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase();
}

function formatDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function formatStatus(status) {
    const labels = {
        pending: "Pending review",
        accepted: "Accepted",
        rejected: "Rejected"
    };

    return labels[status] || "Unknown";
}

function statusBadge(status) {
    return `
        <span class="status-badge ${escapeHTML(status)}">
            ${escapeHTML(formatStatus(status))}
        </span>
    `;
}

function applicantCell(application) {
    return `
        <div class="applicant-cell">
            <div class="applicant-avatar">
                ${escapeHTML(getInitials(application.name))}
            </div>

            <div class="applicant-copy">
                <strong>${escapeHTML(application.name)}</strong>
                <span>${escapeHTML(application.email)}</span>
            </div>
        </div>
    `;
}

function getCounts() {
    return {
        total: applications.length,
        pending: applications.filter(item => item.status === "pending").length,
        accepted: applications.filter(item => item.status === "accepted").length,
        rejected: applications.filter(item => item.status === "rejected").length
    };
}

/* ------------------------------
   Navigation
------------------------------ */

const viewTitles = {
    dashboard: "Dashboard",
    applications: "Applications",
    members: "Members",
    settings: "Settings"
};

function showView(viewName) {
    if (!viewTitles[viewName]) {
        return;
    }

    $$(".view-section").forEach(section => {
        section.classList.toggle(
            "active",
            section.id === `view-${viewName}`
        );
    });

    $$(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );
    });

    $("#pageTitle").textContent = viewTitles[viewName];

    closeSidebar();

    if (viewName === "applications") {
        renderApplications();
    }

    if (viewName === "members") {
        renderMembers();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

$$(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        showView(button.dataset.view);
    });
});

$$("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        showView(button.dataset.go);
    });
});

/* ------------------------------
   Mobile sidebar
------------------------------ */

const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");
const mobileMenuButton = $("#mobileMenuButton");

function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("visible");
    mobileMenuButton.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
    mobileMenuButton.setAttribute("aria-expanded", "false");
}

mobileMenuButton.addEventListener("click", () => {
    if (sidebar.classList.contains("open")) {
        closeSidebar();
    } else {
        openSidebar();
    }
});

sidebarOverlay.addEventListener("click", closeSidebar);

/* ------------------------------
   Dashboard
------------------------------ */

function renderDashboard() {
    const counts = getCounts();

    $("#statTotal").textContent = counts.total;
    $("#statPending").textContent = counts.pending;
    $("#statAccepted").textContent = counts.accepted;
    $("#statRejected").textContent = counts.rejected;

    $("#sidebarPendingCount").textContent = counts.pending;

    $("#overviewTotal").textContent = counts.total;
    $("#overviewAccepted").textContent = counts.accepted;
    $("#overviewPending").textContent = counts.pending;
    $("#overviewRejected").textContent = counts.rejected;

    const total = counts.total || 1;

    $("#acceptedProgress").style.width =
        `${(counts.accepted / total) * 100}%`;

    $("#pendingProgress").style.width =
        `${(counts.pending / total) * 100}%`;

    $("#rejectedProgress").style.width =
        `${(counts.rejected / total) * 100}%`;

    const recentApplications = [...applications]
        .sort((a, b) => b.submitted.localeCompare(a.submitted))
        .slice(0, 4);

    $("#recentApplicationsBody").innerHTML = recentApplications
        .map(application => `
            <tr>
                <td>${applicantCell(application)}</td>

                <td>
                    <span class="type-chip">
                        ${escapeHTML(
                            application.type === "faculty"
                                ? "Faculty"
                                : "Student"
                        )}
                    </span>
                </td>

                <td>${statusBadge(application.status)}</td>

                <td>
                    <button class="row-action"
                            data-open-application="${application.id}"
                            aria-label="View ${escapeHTML(application.name)}">
                        View <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </td>
            </tr>
        `)
        .join("");

    $("#recentEmpty").classList.toggle(
        "hidden",
        recentApplications.length > 0
    );
}

/* ------------------------------
   Application search and filters
------------------------------ */

function getFilteredApplications() {
    const query = $("#applicationSearch").value
        .trim()
        .toLowerCase();

    const selectedStatus = $("#statusFilter").value;
    const selectedType = $("#typeFilter").value;

    return [...applications]
        .filter(application => {
            const matchesSearch =
                application.name.toLowerCase().includes(query) ||
                application.email.toLowerCase().includes(query) ||
                application.interests.some(interest =>
                    interest.toLowerCase().includes(query)
                );

            const matchesStatus =
                selectedStatus === "all" ||
                application.status === selectedStatus;

            const matchesType =
                selectedType === "all" ||
                application.type === selectedType;

            return matchesSearch && matchesStatus && matchesType;
        })
        .sort((a, b) => b.submitted.localeCompare(a.submitted));
}

function renderApplications() {
    const filtered = getFilteredApplications();

    $("#applicationResultCount").textContent =
        `${filtered.length} ${
            filtered.length === 1 ? "application" : "applications"
        }`;

    $("#applicationsTableBody").innerHTML = filtered
        .map(application => `
            <tr>
                <td>${applicantCell(application)}</td>

                <td>
                    <span class="type-chip">
                        ${escapeHTML(
                            application.type === "faculty"
                                ? "Faculty"
                                : "Student"
                        )}
                    </span>
                </td>

                <td>${escapeHTML(formatDate(application.submitted))}</td>

                <td>
                    <div class="interest-cell">
                        ${escapeHTML(application.interests.join(", "))}
                    </div>
                </td>

                <td>${statusBadge(application.status)}</td>

                <td>
                    <button class="row-action"
                            data-open-application="${application.id}">
                        <i class="fa-regular fa-eye"></i>
                        Details
                    </button>
                </td>
            </tr>
        `)
        .join("");

    $("#applicationsEmpty").classList.toggle(
        "hidden",
        filtered.length > 0
    );
}

$("#applicationSearch").addEventListener("input", renderApplications);
$("#statusFilter").addEventListener("change", renderApplications);
$("#typeFilter").addEventListener("change", renderApplications);

/* ------------------------------
   Application details modal
------------------------------ */

function openApplication(applicationId) {
    const application = applications.find(
        item => item.id === Number(applicationId)
    );

    if (!application) {
        showToast("This application could not be found.");
        return;
    }

    selectedApplicationId = application.id;

    $("#modalApplicantName").textContent = application.name;
    $("#modalApplicantEmail").textContent = application.email;

    $("#modalApplicantType").textContent =
        application.type === "faculty" ? "Faculty" : "Student";

    $("#modalApplicantStatus").className =
        `status-badge ${application.status}`;

    $("#modalApplicantStatus").textContent =
        formatStatus(application.status);

    $("#modalAcademicLevel").textContent = application.level;
    $("#modalSubmissionDate").textContent = formatDate(application.submitted);
    $("#modalMotivation").textContent = application.motivation;

    $("#modalInterests").innerHTML = application.interests
        .map(interest => `
            <span class="interest-tag">${escapeHTML(interest)}</span>
        `)
        .join("");

    $("#applicationModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";

    const pending = application.status === "pending";

    $("#acceptApplicationButton").disabled = !pending;
    $("#rejectApplicationButton").disabled = !pending;

    $("#acceptApplicationButton").style.opacity = pending ? "1" : "0.45";
    $("#rejectApplicationButton").style.opacity = pending ? "1" : "0.45";
}

function closeApplicationModal() {
    $("#applicationModal").classList.add("hidden");
    document.body.style.overflow = "";
    selectedApplicationId = null;
}

$("#closeModalButton").addEventListener("click", closeApplicationModal);

$("#applicationModal").addEventListener("click", event => {
    if (event.target === $("#applicationModal")) {
        closeApplicationModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeApplicationModal();
        closeSidebar();
    }
});

/* ------------------------------
   Demo status updates
------------------------------ */

function updateApplicationStatus(newStatus) {
    if (!["pending", "accepted", "rejected"].includes(newStatus)) {
        return;
    }

    const application = applications.find(
        item => item.id === selectedApplicationId
    );

    if (!application) {
        return;
    }

    if (application.status === newStatus) {
        showToast(`This application is already ${formatStatus(newStatus).toLowerCase()}.`);
        return;
    }

    application.status = newStatus;

    renderDashboard();
    renderApplications();
    renderMembers();

    closeApplicationModal();

    const messages = {
        pending: "Application returned to review.",
        accepted: "Application accepted. Demo member list updated.",
        rejected: "Application rejected in this demo."
    };

    showToast(messages[newStatus]);
}

$("#acceptApplicationButton").addEventListener("click", () => {
    updateApplicationStatus("accepted");
});

$("#rejectApplicationButton").addEventListener("click", () => {
    updateApplicationStatus("rejected");
});

$("#returnPendingButton").addEventListener("click", () => {
    updateApplicationStatus("pending");
});

/*
 * Event delegation allows View/Details buttons to work
 * after the tables have been re-rendered.
 */
document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-application]");

    if (button) {
        openApplication(button.dataset.openApplication);
    }
});

/* ------------------------------
   Members
------------------------------ */

function renderMembers() {
    const query = $("#memberSearch").value.trim().toLowerCase();

    const members = applications.filter(application => {
        const isAccepted = application.status === "accepted";

        const matchesSearch =
            application.name.toLowerCase().includes(query) ||
            application.email.toLowerCase().includes(query) ||
            application.interests.some(interest =>
                interest.toLowerCase().includes(query)
            );

        return isAccepted && matchesSearch;
    });

    const acceptedCount = applications.filter(
        application => application.status === "accepted"
    ).length;

    $("#memberCount").textContent =
        `${acceptedCount} ${acceptedCount === 1 ? "member" : "members"}`;

    $("#membersGrid").innerHTML = members
        .map(member => `
            <article class="member-card">
                <div class="member-card-top">
                    <div class="applicant-avatar">
                        ${escapeHTML(getInitials(member.name))}
                    </div>

                    <div>
                        <h3>${escapeHTML(member.name)}</h3>
                        <p class="member-email">${escapeHTML(member.email)}</p>
                    </div>
                </div>

                <div class="member-card-divider"></div>

                <div class="member-meta">
                    <div class="member-meta-row">
                        <span>Membership</span>
                        <strong>Accepted</strong>
                    </div>

                    <div class="member-meta-row">
                        <span>Category</span>
                        <strong>
                            ${escapeHTML(
                                member.type === "faculty"
                                    ? "Faculty"
                                    : "Student"
                            )}
                        </strong>
                    </div>

                    <div class="member-meta-row">
                        <span>Academic level / role</span>
                        <strong>${escapeHTML(member.level)}</strong>
                    </div>

                    <div class="member-meta-row">
                        <span>Interests</span>
                        <strong>${escapeHTML(member.interests.join(", "))}</strong>
                    </div>
                </div>
            </article>
        `)
        .join("");

    $("#membersEmpty").classList.toggle("hidden", members.length > 0);
}

$("#memberSearch").addEventListener("input", renderMembers);

/* ------------------------------
   Notifications
------------------------------ */

function showToast(message) {
    const toast = $("#toastMessage");

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("visible");
    }, 2800);
}

/* ------------------------------
   Initialization
------------------------------ */

function initializeDashboard() {
    $("#currentDate").textContent = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

    renderDashboard();
    renderApplications();
    renderMembers();
}

initializeDashboard();
