import { useState, useEffect, useRef } from 'react'
import { Page, PageHeader, Card, Pill } from '@/components/page'
import { User, Bell, Save, KeyRound, Eye, EyeOff, Building, Users, Camera, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { DEPARTMENTS } from '@/lib/departments'
import { Button } from '@/components/ui/button'
import { API_URL, BASE_URL } from '@/lib/api'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [user, setUser] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  
  // Profile state
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isDeptOpen, setIsDeptOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Notifications state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)

  // Org Settings state
  const [orgName, setOrgName] = useState('')
  const [orgDomain, setOrgDomain] = useState('')
  const [orgAddress, setOrgAddress] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data)
        setFullName(data.full_name || '')
        setEmail(data.email || '')
        setPhone(data.phone || '')
        setPosition(data.position || data.job_title || '')
        setDepartment(data.department || '')
        setBio(data.bio || '')
        setAvatarUrl(data.avatar_url || '')
        if (data.notification_settings) {
          const settings = typeof data.notification_settings === 'string' 
            ? JSON.parse(data.notification_settings) 
            : data.notification_settings
          setEmailNotifications(settings.email ?? true)
          setPushNotifications(settings.push ?? false)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchOrgDetails = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/organizations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setOrg(data)
        setOrgName(data.name || '')
        setOrgDomain(data.domain || '')
        setOrgAddress(data.address || '')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchOrgMembers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/organizations/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchOrgDetails()
    fetchOrgMembers()
  }, [])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.role !== 'super_admin') {
      alert('Only Super Admin can update profile information.')
      return
    }
    setSavingProfile(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName,
          phone,
          position,
          department,
          bio
        })
      })

      if (response.ok) {
        const updatedUser = await response.json()
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
        localStorage.setItem('user', JSON.stringify({ ...storedUser, fullName: updatedUser.full_name }))
        window.dispatchEvent(new Event('profile-updated'))
        toast.success('Profile updated successfully!')
        fetchProfile()
      } else {
        toast.error('Failed to update profile')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match')
      return
    }
    setChangingPassword(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      if (response.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        toast.success('Password updated successfully!')
      } else {
        const err = await response.json()
        toast.error(err.error || 'Failed to change password')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNotifications(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/auth/notification-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: {
            email: emailNotifications,
            push: pushNotifications
          }
        })
      })

      if (response.ok) {
        toast.success('Notification settings updated!')
      } else {
        toast.error('Failed to update notification settings')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingNotifications(false)
    }
  }

  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (user?.role !== 'super_admin') {
      console.warn('Only Super Admin can edit organization details.')
      return
    }
    setSavingOrg(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/organizations/${org.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: orgName,
          domain: orgDomain,
          address: orgAddress
        })
      })

      if (response.ok) {
        toast.success('Organization details updated!')
        fetchOrgDetails()
      } else {
        toast.error('Failed to update organization details')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingOrg(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('avatar', file)

    setUploadingAvatar(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/auth/upload-avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      if (response.ok) {
        window.dispatchEvent(new Event('profile-updated'))
        toast.success('Profile picture updated successfully!')
        fetchProfile()
      } else {
        toast.error('Failed to upload profile picture')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const copyOrgId = () => {
    if (org?.id) {
      navigator.clipboard.writeText(org.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isSuperAdmin = user?.role === 'super_admin'

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SA'

  return (
    <Page>
      <PageHeader
        title="Settings"
        description="Manage your account preferences, profile details, and security."
      />

      {/* Tabs list */}
      <div className="flex border-b border-border/80">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold focus:outline-none transition-all ${
            activeTab === 'profile'
              ? 'border-[#7D5CE4] text-[#7D5CE4]'
              : 'border-transparent text-[#8A8E98] hover:text-foreground'
          }`}
        >
          <User className="h-4 w-4" /> Profile Details
        </button>

        <button
          onClick={() => setActiveTab('org')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold focus:outline-none transition-all ${
            activeTab === 'org'
              ? 'border-[#7D5CE4] text-[#7D5CE4]'
              : 'border-transparent text-[#8A8E98] hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" /> Organization Settings
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold focus:outline-none transition-all ${
            activeTab === 'notifications'
              ? 'border-[#7D5CE4] text-[#7D5CE4]'
              : 'border-transparent text-[#8A8E98] hover:text-foreground'
          }`}
        >
          <Bell className="h-4 w-4" /> Notifications
        </button>
      </div>

      {/* Tab Contents - Width is Full */}
      <div className="mt-6 w-full space-y-6">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-sm font-bold text-foreground">Personal Information</h3>
              <p className="text-xs text-[#8A8E98] mt-0.5">Update your personal details and contact information</p>

              {/* Photo Upload Section */}
              <div className="flex items-center gap-6 mt-6 pb-6 border-b border-border/50">
                <div className="relative group">
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-[#7D5CE4]/10 text-xl font-bold text-[#7D5CE4] border-2 border-[#7D5CE4]/20 overflow-hidden">
                    {avatarUrl ? (
                      <img src={`${BASE_URL}${avatarUrl}`} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                <div>
                  <p className="font-bold text-lg text-foreground">{fullName || 'Super Admin'}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Pill tone="primary">{user?.role ? user.role.replace(/_/g, ' ').toUpperCase() : 'SUPER ADMIN'}</Pill>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[10px] font-bold text-foreground hover:bg-muted"
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={!isSuperAdmin}
                      className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</label>
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold focus:outline-none cursor-not-allowed text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      disabled={!isSuperAdmin}
                      className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Title</label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Software Engineer"
                      disabled={!isSuperAdmin}
                      className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                  <button
                    type="button"
                    disabled={!isSuperAdmin}
                    onClick={() => setIsDeptOpen(!isDeptOpen)}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:outline-none flex items-center justify-between text-foreground disabled:bg-muted/30 disabled:text-muted-foreground disabled:cursor-not-allowed"
                  >
                    <span>{department || 'Select Department'}</span>
                    <span className="text-[#8A8E98] text-[10px]">▼</span>
                  </button>
                  {isDeptOpen && isSuperAdmin && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsDeptOpen(false)} />
                      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
                        {DEPARTMENTS.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => {
                              setDepartment(dept)
                              setIsDeptOpen(false)
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-[#7D5CE4]/10 hover:text-[#7D5CE4] transition-colors"
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={3}
                    disabled={!isSuperAdmin}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none resize-none disabled:bg-muted/30 disabled:text-muted-foreground"
                  />
                </div>

                {isSuperAdmin && (
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20"
                  >
                    <Save className="h-3.5 w-3.5" /> {savingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </form>
            </Card>

            {/* Change Password Card directly below profile information */}
            <Card className="p-6">
              <h3 className="text-sm font-bold text-foreground">Change Password</h3>
              <p className="text-xs text-[#8A8E98] mt-0.5">Update your account password</p>

              <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7D5CE4] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#7D5CE4]/20 hover:opacity-95 disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" /> {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'org' && org && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-sm font-bold text-foreground">Organization Details</h3>
              <p className="text-xs text-[#8A8E98] mt-0.5">
                {isSuperAdmin ? 'Only Super Admin can change organization settings.' : 'View your organization details.'}
              </p>

              <form onSubmit={handleOrgSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Organization Name</label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!isSuperAdmin}
                      className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Domain</label>
                    <input
                      type="text"
                      value={orgDomain}
                      onChange={(e) => setOrgDomain(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="@company.com"
                      className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Address</label>
                  <input
                    type="text"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="Headquarters Address"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none disabled:bg-muted/30 disabled:text-muted-foreground"
                  />
                </div>

                {/* Organization ID - Non-editable, only copyable */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Organization ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={org?.id || ''}
                      className="w-full rounded-xl border border-border bg-muted/30 py-2 pl-3 pr-10 text-xs font-semibold text-muted-foreground focus:outline-none cursor-default"
                    />
                    <button
                      type="button"
                      onClick={copyOrgId}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-foreground"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isSuperAdmin && (
                  <Button
                    type="submit"
                    disabled={savingOrg}
                    className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20"
                  >
                    <Save className="h-3.5 w-3.5" /> {savingOrg ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </form>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-4.5 w-4.5 text-[#7D5CE4]" />
                <h3 className="text-sm font-bold text-foreground">Organization Members</h3>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 font-semibold uppercase tracking-wider text-[#8A8E98]">
                      <th className="px-4 py-2">Member</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m: any) => (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2 flex items-center gap-2">
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-[#7D5CE4]/10 text-[10px] font-bold text-[#7D5CE4]">
                            {m.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{m.full_name}</div>
                            <div className="text-[9px] text-[#8A8E98]">{m.email}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Pill tone={m.role === 'super_admin' ? 'danger' : m.role === 'admin' ? 'warning' : 'primary'}>
                            {m.role?.replace('_', ' ').toUpperCase()}
                          </Pill>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold ${m.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {m.is_active ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'security' && (
          <Card className="p-6">
            <h3 className="text-sm font-bold text-foreground">Update Password</h3>
            <p className="text-xs text-[#8A8E98] mt-0.5">Ensure your account stays secure by updating your credentials.</p>

            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-border bg-surface-2/40 py-2 pl-3 pr-10 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={changingPassword}
                className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20"
              >
                <KeyRound className="h-3.5 w-3.5" /> {changingPassword ? 'Updating...' : 'Change Password'}
              </Button>
            </form>
          </Card>
        )}

        {activeTab === 'notifications' && (
          <Card className="p-6">
            <h3 className="text-sm font-bold text-foreground">Notification Preferences</h3>
            <p className="text-xs text-[#8A8E98] mt-0.5">Control how you receive updates and alerts.</p>

            <form onSubmit={handleNotificationSubmit} className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div>
                  <div className="text-xs font-semibold">Email Notifications</div>
                  <div className="text-[10px] text-[#8A8E98]">Receive weekly summary reports and activity digests.</div>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="rounded border-border text-[#7D5CE4] focus:ring-[#7D5CE4] h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between pb-3">
                <div>
                  <div className="text-xs font-semibold">Push Notifications</div>
                  <div className="text-[10px] text-[#8A8E98]">Receive real-time notifications inside the browser window.</div>
                </div>
                <input
                  type="checkbox"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                  className="rounded border-border text-[#7D5CE4] focus:ring-[#7D5CE4] h-4 w-4"
                />
              </div>

              <Button
                type="submit"
                disabled={savingNotifications}
                className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20"
              >
                <Save className="h-3.5 w-3.5" /> {savingNotifications ? 'Saving...' : 'Save Preferences'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </Page>
  )
}
