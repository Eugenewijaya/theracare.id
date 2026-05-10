import React, { useState, useMemo, useEffect } from 'react';
import { adminApi } from '../../shared/api/client';

const normalizeRoom = (room) => ({ ...room });

function App() {
  const [rooms, setRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminApi.getRooms();
        if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ruangan');
        setRooms((res.data?.data || []).map(normalizeRoom));
      } catch (e) {
        console.error(e);
        showToast(e.message || 'Gagal memuat ruangan', 'error');
      }
    };
    load();
  }, []);

  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  // Form states
  const [formData, setFormData] = useState({ name: '', type: '', capacity: 1, status: 'active' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Handlers ---
  const handleOpenCreate = () => {
    setEditingRoom(null);
    setFormData({ name: '', type: '', capacity: 1, status: 'active' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room) => {
    setEditingRoom(room);
    setFormData(normalizeRoom(room));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setFormError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError('Nama ruangan wajib diisi.'); return; }
    setFormError('');

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        capacity: formData.capacity,
        status: formData.status,
      };
      let saveRes;
      if (editingRoom) {
        saveRes = await adminApi.updateRoom(editingRoom.id, payload);
      } else {
        saveRes = await adminApi.createRoom(payload);
      }
      if (!saveRes.ok) throw new Error(saveRes.data?.error || saveRes.data?.message || 'Gagal menyimpan ruangan');
      showToast(
        editingRoom
          ? `Ruangan "${formData.name}" berhasil diperbarui.`
          : `Ruangan "${formData.name}" berhasil ditambahkan.`
      );
      handleCloseModal();
      const res = await adminApi.getRooms();
      if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ulang ruangan');
      setRooms((res.data?.data || []).map(normalizeRoom));
    } catch(e) {
      showToast(e.message || 'Terjadi kesalahan', 'error');
    }
  };

  const handleDelete = async () => {
    const name = deleteConfirm.name;
    try {
      const deleteRes = await adminApi.deleteRoom(deleteConfirm.id);
      if (!deleteRes.ok) throw new Error(deleteRes.data?.error || deleteRes.data?.message || 'Gagal menghapus ruangan');
      setDeleteConfirm(null);
      showToast(`Ruangan "${name}" telah dihapus.`, 'warning');
      const res = await adminApi.getRooms();
      if (!res.ok) throw new Error(res.data?.error || 'Gagal memuat ulang ruangan');
      setRooms((res.data?.data || []).map(normalizeRoom));
    } catch(e) {
      showToast(e.message || 'Gagal menghapus ruangan', 'error');
    }
  };

  // --- Filtering ---
  const filteredRooms = useMemo(() => {
    return rooms.filter(r => 
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.type || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [rooms, search]);

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold border backdrop-blur-sm transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/80 dark:text-emerald-200 dark:border-emerald-700'
          : toast.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-700'
          : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/80 dark:text-red-200 dark:border-red-700'
        }`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 w-full overflow-hidden text-slate-900 dark:text-slate-100 font-sans">
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="px-4 sm:px-8 py-4 sm:py-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1 items-center flex gap-2">
              <span className="material-symbols-outlined text-primary text-3xl">meeting_room</span>
              Room Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage clinic spaces, room type, capacity, and availability status.</p>
          </div>
          <button 
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-slate-900 font-bold rounded-lg transition-colors flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Room
          </button>
        </header>

        {/* Filters */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center gap-4 shrink-0 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text" 
              placeholder="Search by room name or type..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Showing {filteredRooms.length} room{filteredRooms.length !== 1 && 's'}
          </p>
        </div>

        {/* Data Table */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="block divide-y divide-slate-100 dark:divide-slate-700/50 sm:hidden">
              {filteredRooms.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <span className="material-symbols-outlined mb-2 text-4xl opacity-50">search_off</span>
                  <p>No rooms found matching "{search}"</p>
                </div>
              ) : filteredRooms.map(room => (
                <article key={room.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-base font-bold text-slate-900 dark:text-slate-100">{room.name}</h3>
                      <p className="break-words text-sm text-slate-500 dark:text-slate-400">{room.type || 'General'}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                      room.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {room.status === 'active' ? 'check_circle' : 'build'}
                      </span>
                      {room.status === 'active' ? 'Active' : 'Maintenance'}
                    </span>
                  </div>
                  <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900/50">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Capacity</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">{room.capacity}</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleOpenEdit(room)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(room)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[680px] table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  <th className="w-[30%] p-4 pl-6">Room Name</th>
                  <th className="w-36 p-4">Status</th>
                  <th className="w-28 p-4 text-center">Capacity</th>
                  <th className="p-4">Room Type</th>
                  <th className="w-28 p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                      <p>No rooms found matching "{search}"</p>
                    </td>
                  </tr>
                ) : filteredRooms.map(room => (
                  <tr key={room.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="p-4 pl-6 font-semibold text-slate-900 dark:text-slate-100">
                      <span className="block truncate" title={room.name}>{room.name}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        room.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {room.status === 'active' ? 'check_circle' : 'build'}
                        </span>
                        {room.status === 'active' ? 'Active' : 'Maintenance'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-sm font-bold">
                        {room.capacity}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-300" title={room.type || 'General'}>{room.type || 'General'}</span>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEdit(room)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Edit Room"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(room)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Delete Room"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </main>

      {/* --- CREATE / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  {editingRoom ? 'edit' : 'add_box'}
                </span>
                {editingRoom ? 'Edit Room Details' : 'Add New Room'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="room-form" onSubmit={handleSave} className="flex flex-col gap-5">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Room Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. OT Room Large"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Room Type / Use Case</label>
                  <input
                    type="text"
                    value={formData.type || ''}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    placeholder="e.g. Occupational Therapy"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Capacity (Children)</label>
                    <input 
                      type="number" 
                      min="1" max="20"
                      value={formData.capacity}
                      onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="maintenance">Under Maintenance</option>
                    </select>
                  </div>
                </div>

              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="room-form"
                className="px-5 py-2 rounded-lg font-bold bg-primary text-slate-900 hover:bg-primary/90 transition-colors shadow-sm text-sm"
              >
                {editingRoom ? 'Save Changes' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col text-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-xl font-bold mb-2">Delete Room?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{deleteConfirm.name}</span>? This action cannot be undone and may affect scheduled sessions.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

export default App;
