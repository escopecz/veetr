// PWA Installation and Update Handler

let deferredPrompt;
const installButton = document.getElementById('install-button');

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show the install button
    installButton.classList.remove('hidden');
    
    // Log the event for debugging
    console.log('beforeinstallprompt event fired');
});

// Listen for app installed event
window.addEventListener('appinstalled', (e) => {
    // Hide the install button
    installButton.classList.add('hidden');
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    
    // Log the installation
    console.log('App was installed');
});

// Set up the install button click handler
document.addEventListener('DOMContentLoaded', () => {
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }
        
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        // Log the outcome
        console.log(`User ${outcome} the installation`);
        
        // Clear the deferredPrompt
        deferredPrompt = null;
        
        // Hide the install button
        installButton.classList.add('hidden');
    });
});

// Check for service worker updates
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed - new version available');
        
        // Notify the user about the update
        const updateNotification = document.createElement('div');
        updateNotification.className = 'update-notification';
        updateNotification.innerHTML = `
            <p>A new version is available!</p>
            <button id="update-button">Refresh to Update</button>
        `;
        document.body.appendChild(updateNotification);
        
        // Set up refresh button
        document.getElementById('update-button').addEventListener('click', () => {
            window.location.reload();
        });
    });
}
