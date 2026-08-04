import { db } from './db';

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
      updated_at: new Date().toISOString()
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

    updates.updated_at = new Date().toISOString();
    await db.store_profile.update(existing.id, updates);
    return { ...existing, ...updates };
  },

  async getOrCreateProfile(ownerUsername) {
    let profile = await this.getProfile(ownerUsername);
    if (!profile) {
      profile = await this.createProfile(ownerUsername);
    }
    return profile;
  }
};
