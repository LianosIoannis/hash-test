import prisma from "../prisma.js";

export type UpdateApplicationInput = {
	code?: string;
	name?: string;
	description?: string | null;
};

export async function createApplication(code: string, name: string, description?: string) {
	return prisma.application.create({
		data: {
			code,
			name,
			description: description ?? null,
		},
	});
}

export async function updateApplication(id: number, input: UpdateApplicationInput) {
	return prisma.application.update({
		where: { id },
		data: input,
	});
}

export async function deleteApplication(id: number) {
	return prisma.application.delete({
		where: { id },
	});
}
