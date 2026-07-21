const statusEl = document.getElementById('status')
const saveButton = document.getElementById('saveButton')

async function saveDetails() {
  const details = {
    deviceName: document.getElementById('name').value.trim(),
    location: document.getElementById('location').value.trim(),
    installCode: document.getElementById('installCode').value.trim(),
  }

  if (!details.deviceName || !details.location || !details.installCode) {
    statusEl.textContent = 'Please enter device name, location, and install code.'
    statusEl.className = 'status error'
    return
  }

  try {
    await window.wmsCompanion.saveUserDetails(details)
    statusEl.textContent = 'Enrollment saved. Minimizing...'
    statusEl.className = 'status success'
    setTimeout(() => {
      window.wmsCompanion.minimizeToTray()
    }, 1500)
  } catch (error) {
    statusEl.textContent = 'Failed to save enrollment data. Please retry.'
    statusEl.className = 'status error'
  }
}

saveButton.addEventListener('click', saveDetails)
