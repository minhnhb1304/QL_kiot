import { db } from './db';
import { syncNow } from '../utils/uuid';

export const storeProfileService = {
  async getProfile(ownerUsername) {
    return await db.store_profile
      .where('owner_username')
      .equals(ownerUsername)
      .first() || null;
  },

  async createProfile(ownerUsername) {
    const profile = {
      owner_username: ownerUsername,
      storeName: '',
      storeSlogan: '',
      storeLogo: null,
      storeAddress: '',
      storePhone: '',
      businessStartDate: '',
      appStartDate: new Date().toISOString().split('T')[0],
      currency: 'VND',
      monthlyRevenueGoal: 0,
      financialMonthStartDay: 1,
      storeNotes: '',
      // uuid cố định 'default': hồ sơ cửa hàng chỉ có đúng một dòng
      uuid: 'default',
      created_at: syncNow(),
      updated_at: syncNow(),
      deleted: 0,
      _dirty: 1,
      server_seq: 0
    };
    const id = await db.store_profile.add(profile);
    return { ...profile, id };
  },

  async updateProfile(ownerUsername, updates) {
    const existing = await this.getProfile(ownerUsername);
    if (!existing) throw new Error('Profile không tồn tại');

    // Validate storeName
    if (updates.storeName !== undefined) {
      const name = updates.storeName.trim();
      if (name.length > 50) throw new Error('Tên cửa hàng tối đa 50 ký tự');
      updates.storeName = name;
    }

    // Validate storePhone
    if (updates.storePhone !== undefined) {
      const phone = updates.storePhone.trim();
      if (phone && !/^[0-9]{9,11}$/.test(phone)) {
        throw new Error('SĐT cửa hàng không hợp lệ');
      }
      updates.storePhone = phone;
    }

    // Validate monthlyRevenueGoal
    if (updates.monthlyRevenueGoal !== undefined) {
      const goal = Number(updates.monthlyRevenueGoal);
      if (isNaN(goal) || goal < 0) throw new Error('Mục tiêu phải là số dương');
      updates.monthlyRevenueGoal = goal;
    }

    updates.updated_at = syncNow();
    updates._dirty = 1;
    delete updates.uuid;
    await db.store_profile.update(existing.id, updates);
    return { ...existing, ...updates };
  },

  async getOrCreateProfile(ownerUsername) {
    let profile = await this.getProfile(ownerUsername);
    if (!profile) {
      profile = await this.createProfile(ownerUsername);
    }
    // Hồ sơ tạo trước v9 chưa có uuid — gán bổ sung để đồng bộ được
    if (!profile.uuid) {
      await db.store_profile.update(profile.id, { uuid: 'default' });
      profile.uuid = 'default';
    }
    return profile;
  },

  async calculateStreak() {
    const transactions = (await db.transactions
      .orderBy('transaction_date')
      .reverse()
      .toArray()).filter(t => !t.deleted);

    if (transactions.length === 0) return 0;

    const uniqueDates = [...new Set(transactions.map(t => t.transaction_date))].sort().reverse();

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < uniqueDates.length; i++) {
      const prev = new Date(uniqueDates[i - 1]);
      const curr = new Date(uniqueDates[i]);
      const diffDays = Math.round((prev - curr) / 86400000);
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
};
