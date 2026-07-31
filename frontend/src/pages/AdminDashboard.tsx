import { useEffect, useState } from 'react'
import { Page, PageHeader, Card, Pill } from '@/components/page'
import { Users, UserPlus, Search, Mail, ShieldAlert, Edit2, Trash2, CheckCircle2, XCircle, Shield, Briefcase, RefreshCw, X, Clock } from 'lucide-react'
import { DEPARTMENTS } from '@/lib/departments'
import { Button } from '@/components/ui/button'
import { API_URL } from '@/lib/api'
import { toast } from 'sonner'

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, admins: 0 })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  
  // Dialog / Edit / Create states
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isInviteDeptOpen, setIsInviteDeptOpen] = useState(false)
  const [isEditDeptOpen, setIsEditDeptOpen] = useState(false)
  const [isInviteRoleOpen, setIsInviteRoleOpen] = useState(false)
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  
  // Form fields
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    role: 'employee',
    department: '',
    position: '',
    phone: ''
  })

  const [editFormData, setEditFormData] = useState({
    fullName: '',
    role: 'employee',
    department: '',
    position: '',
    phone: '',
    is_active: true
  })

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      
      const queryParams = new URLSearchParams()
      if (searchTerm) queryParams.append('search', searchTerm)
      if (filterRole !== 'all') queryParams.append('role', filterRole)
      if (filterStatus !== 'all') queryParams.append('status', filterStatus)
      if (filterDept !== 'all') queryParams.append('department', filterDept)
      queryParams.append('includeSelf', 'true')
      queryParams.append('includeSuperAdmin', 'true')

      const response = await fetch(`${API_URL}/members?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/members/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [searchTerm, filterRole, filterStatus, filterDept])

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        setIsInviteOpen(false)
        setFormData({ fullName: '', email: '', role: 'employee', department: '', position: '', phone: '' })
        fetchUsers()
        fetchStats()
      } else {
        const err = await response.json()
        alert(err.error || 'Failed to send invitation')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/members/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      })
      
      if (response.ok) {
        setIsEditOpen(false)
        fetchUsers()
        fetchStats()
      } else {
        const err = await response.json()
        alert(err.error || 'Failed to update user')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const confirmDeleteUser = (userId: string) => {
    setUserToDelete(userId)
    setIsDeleteOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/members/${userToDelete}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        toast.success('Successfully deleted')
        fetchUsers()
        fetchStats()
      } else {
        const err = await response.json()
        toast.error(err.error || 'Failed to delete user')
      }
    } catch (e) {
      console.error(e)
      toast.error('Something went wrong')
    } finally {
      setIsDeleteOpen(false)
      setUserToDelete(null)
    }
  }

  const activeUsers = users.filter((u) => u.invite_status === 'active')

  return (
    <Page>
      <PageHeader
        title="Employee Management"
        description="Manage organization employees and system access."
        actions={
          <Button onClick={() => setIsInviteOpen(true)} className="h-9 px-4 text-xs font-bold">
            <UserPlus className="h-4 w-4" /> Create Employee
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-5 flex items-center justify-between shadow-sm bg-surface text-foreground border border-border">
          <div>
            <p className="text-[10px] text-[#8A8E98] uppercase tracking-wider font-bold">Total Users</p>
            <p className="text-3xl font-bold mt-1 text-foreground">{stats.total || activeUsers.length}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-[#7D5CE4]/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-[#7D5CE4]" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between shadow-sm bg-surface text-foreground border border-border">
          <div>
            <p className="text-[10px] text-[#8A8E98] uppercase tracking-wider font-bold">Active Users</p>
            <p className="text-3xl font-bold mt-1 text-emerald-500">{stats.active}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-emerald-500" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between shadow-sm bg-surface text-foreground border border-border">
          <div>
            <p className="text-[10px] text-[#8A8E98] uppercase tracking-wider font-bold">Admins</p>
            <p className="text-3xl font-bold mt-1 text-violet-500">{stats.admins}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-violet-500" />
          </div>
        </Card>

        <Card className="p-5 flex items-center justify-between shadow-sm bg-surface text-rose-500 border border-border">
          <div>
            <p className="text-[10px] text-[#8A8E98] uppercase tracking-wider font-bold">Inactive</p>
            <p className="text-3xl font-bold mt-1 text-rose-500">{stats.inactive}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-rose-500/10 flex items-center justify-center">
            <XCircle className="h-5 w-5 text-rose-500" />
          </div>
        </Card>
      </div>

      {/* Pending Invitations Section */}
      <Card className="border-none shadow-sm bg-card/50 mt-6">
        <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Pending Invitations</h3>
            <span className="ml-1 text-xs font-bold bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full">
              {users.filter(u => u.invite_status === 'pending' || u.invite_status === 'expired').length}
            </span>
          </div>
        </div>
        <div className="p-0">
          {users.filter(u => u.invite_status === 'pending' || u.invite_status === 'expired').length === 0 ? (
            <div className="px-6 py-4 text-xs text-[#8A8E98] font-semibold">
              No pending invitations.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {users.filter(u => u.invite_status === 'pending' || u.invite_status === 'expired').map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-sm text-foreground">
                      {invite.full_name || invite.email}
                    </span>
                    <span className="text-xs text-[#8A8E98]">
                      Role: {invite.role?.replace(/_/g, ' ')} &middot; Sent:{" "}
                      {new Date(invite.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                      {invite.expires_at && (
                        <> &middot; Expires:{" "}
                          {new Date(invite.expires_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      title="Resend Invite"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token')
                          const response = await fetch(`${API_URL}/members/${invite.id}/resend-invite`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          })
                          if (response.ok) {
                            toast.success('Invitation resent successfully!')
                            fetchUsers()
                          } else {
                            toast.error('Failed to resend invitation')
                          }
                        } catch (err) {
                          toast.error('Something went wrong')
                        }
                      }}
                      className="h-8 w-8 text-[#8A8E98] hover:text-[#7D5CE4] hover:bg-[#7D5CE4]/10 rounded-lg border border-border flex items-center justify-center transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      title="Delete Invite"
                      onClick={() => confirmDeleteUser(invite.id)}
                      className="h-8 w-8 text-[#8A8E98] hover:text-rose-600 hover:bg-rose-500/10 rounded-lg border border-border flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Filter and Search controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
        <div className="relative max-w-sm flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#8A8E98]">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-4 text-xs font-medium focus:border-[#7D5CE4] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="team_lead">Team Lead</option>
            <option value="employee">Employee</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold focus:outline-none"
          >
            <option value="all">All Depts</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <button
            onClick={() => {
              fetchUsers()
              fetchStats()
            }}
            className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-surface text-[#8A8E98] hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Users List Table */}
      <Card className="overflow-hidden mt-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 font-semibold uppercase tracking-wider text-[#8A8E98]">
                <th className="px-6 py-3">Member</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Joined</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#8A8E98]">
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#7D5CE4] border-t-transparent" />
                  </td>
                </tr>
              ) : activeUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8A8E98] font-medium">
                    No users found matching filters.
                  </td>
                </tr>
              ) : (
                activeUsers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3.5 flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-[#7D5CE4]/10 text-xs font-bold text-[#7D5CE4]">
                        {member.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{member.full_name}</div>
                        <div className="text-[10px] text-[#8A8E98]">{member.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <Pill tone={member.role === 'super_admin' ? 'danger' : member.role === 'admin' ? 'warning' : 'primary'}>
                        {member.role?.replace('_', ' ').toUpperCase()}
                      </Pill>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-foreground">{member.department || '—'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        member.invite_status === 'pending'
                          ? 'text-amber-500'
                          : member.is_active
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                      }`}>
                        {member.invite_status === 'pending'
                          ? '○ Pending'
                          : member.is_active
                          ? '● Active'
                          : '○ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-foreground">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedUser(member)
                            setEditFormData({
                              fullName: member.full_name || '',
                              role: member.role || 'employee',
                              department: member.department || '',
                              position: member.position || '',
                              phone: member.phone || '',
                              is_active: member.is_active ?? true
                            })
                            setIsEditOpen(true)
                          }}
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-[#8A8E98] hover:text-foreground"
                          title="Edit User"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDeleteUser(member.id)}
                          className="p-1.5 rounded-lg border border-border hover:bg-red-500/10 text-[#8A8E98] hover:text-rose-600"
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog for inviting members */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in scale-in duration-200">
            <button
              onClick={() => setIsInviteOpen(false)}
              className="absolute right-4 top-4 text-[#8A8E98] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-xl bg-[#7D5CE4]/10 p-2.5 text-[#7D5CE4] border border-[#7D5CE4]/20">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Add New Employee</h3>
                <p className="text-xs text-[#8A8E98] mt-0.5">
                  Configure basic account information
                </p>
              </div>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@rushcorporation.com"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Title / Position</label>
                  <input
                    type="text"
                    required
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="e.g. Sales Manager"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                  <button
                    type="button"
                    onClick={() => setIsInviteDeptOpen(!isInviteDeptOpen)}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:outline-none flex items-center justify-between text-foreground"
                  >
                    <span>{formData.department || 'Select Department'}</span>
                    <span className="text-[#8A8E98] text-[10px]">▼</span>
                  </button>
                  {isInviteDeptOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsInviteDeptOpen(false)} />
                      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
                        {DEPARTMENTS.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, department: dept })
                              setIsInviteDeptOpen(false)
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

                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Role</label>
                  <button
                    type="button"
                    onClick={() => setIsInviteRoleOpen(!isInviteRoleOpen)}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:outline-none flex items-center justify-between text-foreground"
                  >
                    <span className="capitalize">{formData.role?.replace(/_/g, ' ')}</span>
                    <span className="text-[#8A8E98] text-[10px]">▼</span>
                  </button>
                  {isInviteRoleOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsInviteRoleOpen(false)} />
                      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
                        {[
                          { val: 'employee', label: 'Employee' },
                          { val: 'team_lead', label: 'Team Lead' },
                          { val: 'manager', label: 'Manager' },
                          { val: 'admin', label: 'Admin' }
                        ].map((r) => (
                          <button
                            key={r.val}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, role: r.val })
                              setIsInviteRoleOpen(false)
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-[#7D5CE4]/10 hover:text-[#7D5CE4] transition-colors"
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant='outline'
                  onClick={() => setIsInviteOpen(false)}
                  className="text-xs font-bold text-[#7D5CE4] hover:text-[#7D5CE4] hover:border-[#7D5CE4] bg-white hover:bg-white/80 transition-colors"
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20">
                  <Users className="h-4 w-4" /> Create Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog for editing members */}
      {isEditOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in scale-in duration-200">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute right-4 top-4 text-[#8A8E98] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold text-foreground">Edit Workspace Member</h3>
            <p className="mt-1 text-xs text-[#8A8E98]">
              Modify details for {selectedUser.email}.
            </p>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  placeholder="Ayaan Khan"
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
                  <button
                    type="button"
                    onClick={() => setIsEditRoleOpen(!isEditRoleOpen)}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:outline-none flex items-center justify-between text-foreground"
                  >
                    <span className="capitalize">{editFormData.role?.replace(/_/g, ' ')}</span>
                    <span className="text-[#8A8E98] text-[10px]">▼</span>
                  </button>
                  {isEditRoleOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsEditRoleOpen(false)} />
                      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
                        {[
                          { val: 'employee', label: 'Employee' },
                          { val: 'team_lead', label: 'Team Lead' },
                          { val: 'manager', label: 'Manager' },
                          { val: 'admin', label: 'Admin' },
                          { val: 'super_admin', label: 'Super Admin' }
                        ].map((r) => (
                          <button
                            key={r.val}
                            type="button"
                            onClick={() => {
                              setEditFormData({ ...editFormData, role: r.val })
                              setIsEditRoleOpen(false)
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-[#7D5CE4]/10 hover:text-[#7D5CE4] transition-colors"
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</label>
                  <button
                    type="button"
                    onClick={() => setIsEditDeptOpen(!isEditDeptOpen)}
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:outline-none flex items-center justify-between text-foreground"
                  >
                    <span>{editFormData.department || 'Select Department'}</span>
                    <span className="text-[#8A8E98] text-[10px]">▼</span>
                  </button>
                  {isEditDeptOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsEditDeptOpen(false)} />
                      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl">
                        {DEPARTMENTS.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => {
                              setEditFormData({ ...editFormData, department: dept })
                              setIsEditDeptOpen(false)
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Position</label>
                  <input
                    type="text"
                    value={editFormData.position}
                    onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                    placeholder="Senior Developer"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-xs font-semibold focus:border-[#7D5CE4] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="rounded border-border text-[#7D5CE4] focus:ring-[#7D5CE4]"
                />
                <label htmlFor="edit-is-active" className="text-xs font-bold text-foreground">
                  User is Active
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <Button type="submit" className="h-9 px-4 text-xs font-bold bg-[#7D5CE4] hover:bg-[#7D5CE4]/80 shadow-md shadow-[#7D5CE4]/20">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in scale-in duration-200">
            <h3 className="text-base font-bold text-foreground mb-2">Confirm Delete</h3>
            <p className="text-xs text-[#8A8E98] mb-6">
              Are you sure you want to permanently delete this user or invitation? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteOpen(false)
                  setUserToDelete(null)
                }}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <Button
                onClick={handleDeleteUser}
                className="h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
