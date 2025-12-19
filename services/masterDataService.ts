/**
 * Master Data Service
 * จัดการข้อมูลผู้ขาย (Vendors) และตารางอำนาจอนุมัติ (Approval Authorities)
 */

import { db, isFirebaseConfigured } from './firebase';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp
} from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export interface Vendor {
    id: string;
    clientId: string;
    code: string;
    name: string;
    nameEn?: string;
    taxId: string;
    branch?: string;
    address: string;
    phone?: string;
    email?: string;
    contactPerson?: string;
    vendorType: 'supplier' | 'service' | 'contractor' | 'other';
    paymentTerms: number;
    whtRate: number;
    bankName?: string;
    bankAccount?: string;
    creditLimit?: number;
    status: 'active' | 'inactive' | 'blacklisted';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ApprovalAuthority {
    id: string;
    clientId: string;
    staffId: string;
    staffName: string;
    role: string;
    approvalLevel: number;
    minAmount: number;
    maxAmount: number;
    documentTypes: string[];
    canApproveOverBudget: boolean;
    canApproveEmergency: boolean;
    status: 'active' | 'inactive';
}

// Collection names
const VENDORS_COLLECTION = 'vendors';
const AUTHORITIES_COLLECTION = 'approval_authorities';

// ============================================================================
// VENDOR CRUD
// ============================================================================

export const loadVendors = async (clientId: string): Promise<Vendor[]> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, returning empty vendors');
        return [];
    }

    try {
        const vendorsRef = collection(db, VENDORS_COLLECTION);
        const q = query(
            vendorsRef,
            where('clientId', '==', clientId),
            orderBy('code', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt
        })) as Vendor[];
    } catch (error) {
        console.error('Error loading vendors:', error);
        return [];
    }
};

export const saveVendor = async (
    vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const vendorsRef = collection(db, VENDORS_COLLECTION);

        if (vendor.id) {
            // Update existing
            const docRef = doc(db, VENDORS_COLLECTION, vendor.id);
            await updateDoc(docRef, {
                ...vendor,
                updatedAt: serverTimestamp()
            });
            return { success: true, id: vendor.id };
        } else {
            // Create new
            const docRef = await addDoc(vendorsRef, {
                ...vendor,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        }
    } catch (error: any) {
        console.error('Error saving vendor:', error);
        return { success: false, error: error.message };
    }
};

export const deleteVendor = async (
    vendorId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await deleteDoc(doc(db, VENDORS_COLLECTION, vendorId));
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting vendor:', error);
        return { success: false, error: error.message };
    }
};

export const getVendorByTaxId = async (
    clientId: string,
    taxId: string
): Promise<Vendor | null> => {
    if (!isFirebaseConfigured || !db) {
        return null;
    }

    try {
        const vendorsRef = collection(db, VENDORS_COLLECTION);
        const q = query(
            vendorsRef,
            where('clientId', '==', clientId),
            where('taxId', '==', taxId)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return {
            id: doc.id,
            ...doc.data()
        } as Vendor;
    } catch (error) {
        console.error('Error getting vendor by tax ID:', error);
        return null;
    }
};

// ============================================================================
// APPROVAL AUTHORITY CRUD
// ============================================================================

export const loadApprovalAuthorities = async (
    clientId: string
): Promise<ApprovalAuthority[]> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, returning empty authorities');
        return [];
    }

    try {
        const authoritiesRef = collection(db, AUTHORITIES_COLLECTION);
        const q = query(
            authoritiesRef,
            where('clientId', '==', clientId),
            orderBy('approvalLevel', 'desc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ApprovalAuthority[];
    } catch (error) {
        console.error('Error loading approval authorities:', error);
        return [];
    }
};

export const saveApprovalAuthority = async (
    authority: Omit<ApprovalAuthority, 'id'> & { id?: string }
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const authoritiesRef = collection(db, AUTHORITIES_COLLECTION);

        if (authority.id) {
            // Update existing
            const docRef = doc(db, AUTHORITIES_COLLECTION, authority.id);
            await updateDoc(docRef, {
                ...authority,
                updatedAt: serverTimestamp()
            });
            return { success: true, id: authority.id };
        } else {
            // Create new
            const docRef = await addDoc(authoritiesRef, {
                ...authority,
                createdAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        }
    } catch (error: any) {
        console.error('Error saving approval authority:', error);
        return { success: false, error: error.message };
    }
};

export const deleteApprovalAuthority = async (
    authorityId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await deleteDoc(doc(db, AUTHORITIES_COLLECTION, authorityId));
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting approval authority:', error);
        return { success: false, error: error.message };
    }
};

export const getApproverForAmount = async (
    clientId: string,
    amount: number,
    documentType: string
): Promise<ApprovalAuthority | null> => {
    if (!isFirebaseConfigured || !db) {
        return null;
    }

    try {
        const authorities = await loadApprovalAuthorities(clientId);

        // Find the authority with the lowest level that can approve this amount
        const eligible = authorities
            .filter(a =>
                a.status === 'active' &&
                a.minAmount <= amount &&
                a.maxAmount >= amount &&
                a.documentTypes.includes(documentType)
            )
            .sort((a, b) => a.approvalLevel - b.approvalLevel);

        return eligible[0] || null;
    } catch (error) {
        console.error('Error finding approver:', error);
        return null;
    }
};

export default {
    loadVendors,
    saveVendor,
    deleteVendor,
    getVendorByTaxId,
    loadApprovalAuthorities,
    saveApprovalAuthority,
    deleteApprovalAuthority,
    getApproverForAmount
};
