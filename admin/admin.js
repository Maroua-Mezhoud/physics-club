
"use strict";

/* ==========================================
   PHYSICS CLUB — Connected Admin Dashboard
   Supabase authentication, database and files
========================================== */

const ADMIN_UID = "8afd9417-60d8-4f36-8f34-96045023fd8c";
const DOCUMENTS_BUCKET = "application-documents";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let applications = [];
let selectedApplicationId = null;
let toastTimeout = null;
let isLoading = false;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

/* ==========================================
   Helpers
========================================== */

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
    return String(name || "Student")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase();
}

function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return "—";

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

function parseInterests(value) {
    if (Array.isArray(value)) return value;

    if (typeof value !== "string" || !value.trim()) return [];

    return value
        .split(/[,;\n]/)
        .map(item => item.trim())
        .filter(Boolean);
}

function getCounts() {
    return {
        total: applications.length,
        pending: applications.filter(a => a.status === "pending").length,
        accepted: applications.filter(a => a.status === "accepted").length,
        rejected: applications.filter(a => a.status === "rejected").length
    };
}

/* ==========================================
   Authentication
========================================== */

function showLogin() {
    $("#loginScreen").classList.remove("hidden");
    $("#appShell").classList.add("hidden");
}

function showAdmin(user) {
    $("#loginScreen").classList.add("hidden");
    $("#appShell").classList.remove("hidden");

    $("#adminEmailLabel").textContent = user.email || "Administrator";
}

function showLoginError(message) {
    $("#loginError").textContent = message;
    $("#loginError").classList.remove("hidden");
}

function clearLoginError() {
    $("#loginError").textContent = "";
    $("#loginError").classList.add("hidden");
}

async function verifyAdmin(user) {
    if (!user || user.id !== ADMIN_UID) {
        await supabaseClient.auth.signOut();
        showLogin();

        showLoginError(
            "This account is not authorized to access the admin dashboard."
        );

        return false;
    }

    showAdmin(user);
    return true;
}

$("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    clearLoginError();

    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value;

    const button = $("#loginButton");
    button.disabled = true;
    button.textContent = "Signing in...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const authorized = await verifyAdmin(data.user);

        if (authorized) {
            $("#loginPassword").value = "";
            await loadApplications();
        }
    } catch (error) {
        console.error("Login failed:", error);
        showLoginError(
            "Sign-in failed. Check your email and password, then try again."
        );
    } finally {
        button.disabled = false;
        button.textContent = "Sign In";
    }
});

$("#signOutButton").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error("Sign-out failed:", error);
        showToast("Could not sign out. Please try again.");
        return;
    }

    applications = [];
    selectedApplicationId = null;
    showLogin();
    $("#loginPassword").value = "";
    clearLoginError();

    showToast("You have signed out.");
});

/* ==========================================
   Load real applications from Supabase
========================================== */

async function loadApplications() {
    if (isLoading) return;

    isLoading = true;

    try {
        const { data, error } = await supabaseClient
            .from("applications")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        applications = (data || []).map(row => ({
            id: row.id,
            name: row.full_name || "Unnamed applicant",
            email: row.email || "",
            type: "student",
            level: row.academic_level || "Not specified",
            submitted: row.created_at || "",
            interests: parseInterests(row.interest),
            status: row.status || "pending",
            motivation: row.motivation || "No motivation statement provided.",
            registrationCertificatePath: row.registration_certificate_path,
            personalPhotoPath: row.personal_photo_path
        }));

        renderDashboard();
        renderApplications();
        renderMembers();

        showToast(`Loaded ${applications.length} real application(s).`);
    } catch (error) {
        console.error("Could not load applications:", error);

        showToast(
            "Could not load applications. Check your connection and Supabase permissions."
        );
    } finally {
        isLoading = false;
    }
}

/* ==========================================
   Navigation
========================================== */

const viewTitles = {
    dashboard: "Dashboard",
    applications: "Applications",
    members: "Members",
    settings: "Settings"
};

function showView(viewName) {
    if (!viewTitles[viewName]) return;

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

    if (viewName === "applications") renderApplications();
    if (viewName === "members") renderMembers();

    window.scrollTo({ top: 0, behavior: "smooth" });
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

/* ==========================================
   Mobile sidebar
========================================== */

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
    sidebar.classList.contains("open")
        ? closeSidebar()
        : openSidebar();
});

sidebarOverlay.addEventListener("click", closeSidebar);

/* ==========================================
   Dashboard statistics and recent applications
========================================== */

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

    const recent = [...applications]
        .sort((a, b) => new Date(b.submitted) - new Date(a.submitted))
        .slice(0, 4);

    $("#recentApplicationsBody").innerHTML = recent.map(application => `
        <tr>
            <td>${applicantCell(application)}</td>

            <td>
                <span class="type-chip">Student</span>
            </td>

            <td>${statusBadge(application.status)}</td>

            <td>
                <button class="row-action"
                        data-open-application="${escapeHTML(application.id)}">
                    View
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
            </td>
        </tr>
    `).join("");

    $("#recentEmpty").classList.toggle("hidden", recent.length > 0);
}

/* ==========================================
   Search and filters
========================================== */

function getFilteredApplications() {
    const query = $("#applicationSearch").value.trim().toLowerCase();
    const selectedStatus = $("#statusFilter").value;
    const selectedType = $("#typeFilter").value;

    return [...applications]
        .filter(application => {
            const searchableText = [
                application.name,
                application.email,
                ...application.interests
            ].join(" ").toLowerCase();

            const matchesSearch = searchableText.includes(query);

            const matchesStatus =
                selectedStatus === "all" ||
                application.status === selectedStatus;

            // The current database stores student applications only.
            const matchesType =
                selectedType === "all" || selectedType === "student";

            return matchesSearch && matchesStatus && matchesType;
        })
        .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
}

function renderApplications() {
    const filtered = getFilteredApplications();

    $("#applicationResultCount").textContent =
        `${filtered.length} ${filtered.length === 1 ? "application" : "applications"}`;

    $("#applicationsTableBody").innerHTML = filtered.map(application => `
        <tr>
            <td>${applicantCell(application)}</td>

            <td><span class="type-chip">Student</span></td>

            <td>${escapeHTML(formatDate(application.submitted))}</td>

            <td>
                <div class="interest-cell">
                    ${escapeHTML(application.interests.join(", ") || "—")}
                </div>
            </td>

            <td>${statusBadge(application.status)}</td>

            <td>
                <button class="row-action"
                        data-open-application="${escapeHTML(application.id)}">
                    <i class="fa-regular fa-eye"></i>
                    Details
                </button>
            </td>
        </tr>
    `).join("");

    $("#applicationsEmpty").classList.toggle("hidden", filtered.length > 0);
}

$("#applicationSearch").addEventListener("input", renderApplications);
$("#statusFilter").addEventListener("change", renderApplications);
$("#typeFilter").addEventListener("change", renderApplications);

/* ==========================================
   Private application documents
========================================== */

async function createDocumentLink(path, label) {
    if (!path) {
        return `<div class="document-item">${escapeHTML(label)}: Not provided</div>`;
    }

    const { data, error } = await supabaseClient
        .storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(path, 300);

    if (error || !data?.signedUrl) {
        console.error(`Could not create link for ${label}:`, error);

        return `
            <div class="document-item">
                ${escapeHTML(label)}: Unable to create document link
            </div>
        `;
    }

    return `
        <div class="document-item">
            <span>${escapeHTML(label)}</span>
            <a href="${escapeHTML(data.signedUrl)}"
               target="_blank"
               rel="noopener noreferrer">
                Open document
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
        </div>
    `;
}

async function renderApplicationDocuments(application) {
    const container = $("#modalDocuments");

    container.textContent = "Loading documents...";

    const [certificate, photo] = await Promise.all([
        createDocumentLink(
            application.registrationCertificatePath,
            "Registration certificate"
        ),
        createDocumentLink(
            application.personalPhotoPath,
            "Personal photo"
        )
    ]);

    // Do not update a modal that now belongs to another application.
    if (selectedApplicationId !== application.id) return;

    container.innerHTML = certificate + photo;
}

/* ==========================================
   Application details modal
========================================== */

async function openApplication(applicationId) {
    const application = applications.find(
        item => item.id === applicationId
    );

    if (!application) {
        showToast("This application could not be found.");
        return;
    }

    selectedApplicationId = application.id;

    $("#modalApplicantName").textContent = application.name;
    $("#modalApplicantEmail").textContent = application.email;
    $("#modalApplicantType").textContent = "Student";

    $("#modalApplicantStatus").className =
        `status-badge ${application.status}`;

    $("#modalApplicantStatus").textContent = formatStatus(application.status);

    $("#modalAcademicLevel").textContent = application.level;
    $("#modalSubmissionDate").textContent = formatDate(application.submitted);
    $("#modalMotivation").textContent = application.motivation;

    $("#modalInterests").innerHTML = application.interests.length
        ? application.interests.map(interest => `
            <span class="interest-tag">${escapeHTML(interest)}</span>
        `).join("")
        : "No interests provided.";

    $("#modalDocuments").textContent = "Loading documents...";
    $("#applicationModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";

    const pending = application.status === "pending";

    $("#acceptApplicationButton").disabled = !pending;
    $("#rejectApplicationButton").disabled = !pending;

    $("#acceptApplicationButton").style.opacity = pending ? "1" : "0.45";
    $("#rejectApplicationButton").style.opacity = pending ? "1" : "0.45";

    await renderApplicationDocuments(application);
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

document.addEventListener("click", event => {
    const button = event.target.closest("[data-open-application]");

    if (button) {
        openApplication(button.dataset.openApplication);
    }
});

/* ==========================================
   Update application status in the database
========================================== */

async function updateApplicationStatus(newStatus) {
    if (!["pending", "accepted", "rejected"].includes(newStatus)) {
        return;
    }

    const application = applications.find(
        item => item.id === selectedApplicationId
    );

    if (!application) return;

    if (application.status === newStatus) {
        showToast(`This application is already ${formatStatus(newStatus).toLowerCase()}.`);
        return;
    }

    const buttons = [
        $("#acceptApplicationButton"),
        $("#rejectApplicationButton"),
        $("#returnPendingButton")
    ];

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const { data, error } = await supabaseClient
            .from("applications")
            .update({ status: newStatus })
            .eq("id", application.id)
            .select("id, status");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "No application was updated. Check the admin UPDATE policy and database permissions."
            );
        }

        application.status = newStatus;

        renderDashboard();
        renderApplications();
        renderMembers();
        closeApplicationModal();

        const messages = {
            pending: "Application returned to pending review.",
            accepted: "Application accepted. Member list updated.",
            rejected: "Application rejected."
        };

        showToast(messages[newStatus]);
    } catch (error) {
        console.error("Status update failed:", error);

        showToast(
            "Status was not updated. Check your Supabase permissions and try again."
        );
    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
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

/* ==========================================
   Accepted members
========================================== */

function renderMembers() {
    const query = $("#memberSearch").value.trim().toLowerCase();

    const members = applications.filter(application => {
        const searchableText = [
            application.name,
            application.email,
            ...application.interests
        ].join(" ").toLowerCase();

        return application.status === "accepted" &&
            searchableText.includes(query);
    });

    const acceptedCount = applications.filter(
        application => application.status === "accepted"
    ).length;

    $("#memberCount").textContent =
        `${acceptedCount} ${acceptedCount === 1 ? "member" : "members"}`;

    $("#membersGrid").innerHTML = members.map(member => `
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
                    <strong>Student</strong>
                </div>

                <div class="member-meta-row">
                    <span>Academic level</span>
                    <strong>${escapeHTML(member.level)}</strong>
                </div>

                <div class="member-meta-row">
                    <span>Interests</span>
                    <strong>${escapeHTML(member.interests.join(", ") || "—")}</strong>
                </div>
            </div>
        </article>
    `).join("");

    $("#membersEmpty").classList.toggle("hidden", members.length > 0);
}

$("#memberSearch").addEventListener("input", renderMembers);

/* ==========================================
   Toast notifications
========================================== */

function showToast(message) {
    const toast = $("#toastMessage");

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("visible");
    }, 3500);
}

/* ==========================================
   Initialization and session restoration
========================================== */

async function initializeDashboard() {
    $("#currentDate").textContent = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date());

    showLogin();

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data.session?.user) {
            const authorized = await verifyAdmin(data.session.user);

            if (authorized) {
                await loadApplications();
            }
        }
    } catch (error) {
        console.error("Session initialization failed:", error);
        showLoginError("Could not verify your session. Please sign in again.");
    }
}

initializeDashboard();
