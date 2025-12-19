/**
 * Payroll Database Service
 * จัดการข้อมูลพนักงานและเงินเดือนใน Firestore
 */

import { db, isFirebaseConfigured } from './firebase';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { Employee, SalaryStructure, PaySlip } from './payroll';

// Collection names
const EMPLOYEES_COLLECTION = 'employees';
const SALARIES_COLLECTION = 'salaries';
const PAYSLIPS_COLLECTION = 'payslips';

// ============================================================================
// EMPLOYEE CRUD
// ============================================================================

export const loadEmployees = async (clientId: string): Promise<Employee[]> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, returning empty employees');
        return [];
    }

    try {
        const employeesRef = collection(db, EMPLOYEES_COLLECTION);
        const q = query(
            employeesRef,
            where('clientId', '==', clientId),
            orderBy('employeeCode', 'asc')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Employee[];
    } catch (error) {
        console.error('Error loading employees:', error);
        return [];
    }
};

export const saveEmployee = async (
    employee: Omit<Employee, 'id'> & { id?: string }
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const employeesRef = collection(db, EMPLOYEES_COLLECTION);

        if (employee.id) {
            // Update existing
            const docRef = doc(db, EMPLOYEES_COLLECTION, employee.id);
            await updateDoc(docRef, {
                ...employee,
                updatedAt: serverTimestamp()
            });
            return { success: true, id: employee.id };
        } else {
            // Create new
            const docRef = await addDoc(employeesRef, {
                ...employee,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        }
    } catch (error: any) {
        console.error('Error saving employee:', error);
        return { success: false, error: error.message };
    }
};

export const deleteEmployee = async (
    employeeId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await deleteDoc(doc(db, EMPLOYEES_COLLECTION, employeeId));
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting employee:', error);
        return { success: false, error: error.message };
    }
};

// ============================================================================
// SALARY STRUCTURE CRUD
// ============================================================================

export const loadSalaryStructure = async (
    employeeId: string
): Promise<SalaryStructure | null> => {
    if (!isFirebaseConfigured || !db) {
        return null;
    }

    try {
        const salariesRef = collection(db, SALARIES_COLLECTION);
        const q = query(salariesRef, where('employeeId', '==', employeeId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const docData = snapshot.docs[0].data();
        return {
            baseSalary: docData.baseSalary || 0,
            positionAllowance: docData.positionAllowance,
            housingAllowance: docData.housingAllowance,
            transportAllowance: docData.transportAllowance,
            mealAllowance: docData.mealAllowance,
            otherAllowance: docData.otherAllowance,
            commission: docData.commission,
            bonus: docData.bonus,
            overtime: docData.overtime,
        };
    } catch (error) {
        console.error('Error loading salary structure:', error);
        return null;
    }
};

export const loadAllSalaryStructures = async (
    clientId: string
): Promise<Record<string, SalaryStructure>> => {
    if (!isFirebaseConfigured || !db) {
        return {};
    }

    try {
        const salariesRef = collection(db, SALARIES_COLLECTION);
        const q = query(salariesRef, where('clientId', '==', clientId));
        const snapshot = await getDocs(q);

        const salaries: Record<string, SalaryStructure> = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            salaries[data.employeeId] = {
                baseSalary: data.baseSalary || 0,
                positionAllowance: data.positionAllowance,
                housingAllowance: data.housingAllowance,
                transportAllowance: data.transportAllowance,
                mealAllowance: data.mealAllowance,
                otherAllowance: data.otherAllowance,
                commission: data.commission,
                bonus: data.bonus,
                overtime: data.overtime,
            };
        });

        return salaries;
    } catch (error) {
        console.error('Error loading salary structures:', error);
        return {};
    }
};

export const saveSalaryStructure = async (
    employeeId: string,
    clientId: string,
    salary: SalaryStructure
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const salariesRef = collection(db, SALARIES_COLLECTION);
        const q = query(salariesRef, where('employeeId', '==', employeeId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // Create new
            await addDoc(salariesRef, {
                employeeId,
                clientId,
                ...salary,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            // Update existing
            const docRef = doc(db, SALARIES_COLLECTION, snapshot.docs[0].id);
            await updateDoc(docRef, {
                ...salary,
                updatedAt: serverTimestamp()
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error saving salary structure:', error);
        return { success: false, error: error.message };
    }
};

// ============================================================================
// PAYSLIP CRUD
// ============================================================================

export const loadPayslips = async (
    clientId: string,
    period?: string
): Promise<PaySlip[]> => {
    if (!isFirebaseConfigured || !db) {
        return [];
    }

    try {
        const payslipsRef = collection(db, PAYSLIPS_COLLECTION);
        let q;

        if (period) {
            q = query(
                payslipsRef,
                where('clientId', '==', clientId),
                where('period', '==', period)
            );
        } else {
            q = query(
                payslipsRef,
                where('clientId', '==', clientId),
                orderBy('createdAt', 'desc')
            );
        }

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        })) as PaySlip[];
    } catch (error) {
        console.error('Error loading payslips:', error);
        return [];
    }
};

export const savePayslip = async (
    payslip: Omit<PaySlip, 'id'> & { id?: string; clientId: string }
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const payslipsRef = collection(db, PAYSLIPS_COLLECTION);

        if (payslip.id) {
            // Update existing
            const docRef = doc(db, PAYSLIPS_COLLECTION, payslip.id);
            await updateDoc(docRef, {
                ...payslip,
                updatedAt: serverTimestamp()
            });
            return { success: true, id: payslip.id };
        } else {
            // Create new
            const docRef = await addDoc(payslipsRef, {
                ...payslip,
                createdAt: serverTimestamp()
            });
            return { success: true, id: docRef.id };
        }
    } catch (error: any) {
        console.error('Error saving payslip:', error);
        return { success: false, error: error.message };
    }
};

export const savePayslipsBatch = async (
    payslips: Array<Omit<PaySlip, 'id'> & { clientId: string }>
): Promise<{ success: boolean; ids: string[]; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, ids: [], error: 'Firebase not configured' };
    }

    try {
        const payslipsRef = collection(db, PAYSLIPS_COLLECTION);
        const ids: string[] = [];

        for (const payslip of payslips) {
            const docRef = await addDoc(payslipsRef, {
                ...payslip,
                createdAt: serverTimestamp()
            });
            ids.push(docRef.id);
        }

        return { success: true, ids };
    } catch (error: any) {
        console.error('Error saving payslips batch:', error);
        return { success: false, ids: [], error: error.message };
    }
};

export const updatePayslipStatus = async (
    payslipId: string,
    status: 'draft' | 'approved' | 'paid',
    approvedBy?: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const docRef = doc(db, PAYSLIPS_COLLECTION, payslipId);
        await updateDoc(docRef, {
            status,
            ...(status === 'approved' ? { approvedAt: serverTimestamp(), approvedBy } : {}),
            ...(status === 'paid' ? { paidAt: serverTimestamp() } : {}),
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        console.error('Error updating payslip status:', error);
        return { success: false, error: error.message };
    }
};

export default {
    loadEmployees,
    saveEmployee,
    deleteEmployee,
    loadSalaryStructure,
    loadAllSalaryStructures,
    saveSalaryStructure,
    loadPayslips,
    savePayslip,
    savePayslipsBatch,
    updatePayslipStatus
};
