void main(){

var lista = ['Rennan'];

print(lista.hashCode);

print(lista);
funcao(lista);

print(lista);

var nome = 'Rennan';

print(nome);
print(nome.hashCode);
funcao2(nome);
print(nome);
print(nome.hashCode);



}

void funcao2(String nome){
nome += ' Academia do FLutter';
print(nome);
print(nome.hashCode);

}

void funcao(List<String> nomes){

print(nomes.hashCode);
if(nomes.isNotEmpty){
nomes.clear();}

}